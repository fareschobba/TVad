// src/services/alerts/monitor.js
const { RULE_IDS } = require('../../config/alerts');

// Reduce an ad to a stable scalar identity string, mirroring how the device
// decides a "significant change" (prefer name, else index). The device sends
// currentAd as a fresh object each heartbeat, so comparing raw references would
// always look like a change and reset the STUCK timer every tick.
function adIdentity(ad) {
  if (ad == null) return null;
  if (typeof ad !== 'object') return ad;            // already a scalar (tests pass strings)
  const name = (ad.name || '').trim();
  if (name) return name;
  const idx = typeof ad.index === 'number' ? ad.index : -1;
  return idx >= 0 ? `#${idx}` : null;
}

function createMonitor(deps) {
  const {
    config, store, emailer,
    getAllDeviceStates, isDeviceConnected,
    isQuietHours, rules, evaluate,
    resolveDevice,                 // async (deviceId) => { deviceId, name, userId }
    now = () => Date.now(),
    processStartedAt = Date.now(),
    logger = console
  } = deps;

  let timer = null;
  const sendWindow = [];           // timestamps of recent sends (rate cap)

  function budgetAvailable(t) {
    while (sendWindow.length && sendWindow[0] <= t - config.rateWindowMs) sendWindow.shift();
    return sendWindow.length < config.rateCap;
  }

  const predicate = { OFFLINE: rules.isOffline, STOPPED: rules.isStopped, STUCK: rules.isStuck };

  function updateTimers(track, s, online, t) {
    track.online = online;
    if (s) {
      if (typeof s.lastUpdate === 'number') {
        track.lastSeenAt = track.lastSeenAt == null ? s.lastUpdate : Math.max(track.lastSeenAt, s.lastUpdate);
      }
      const p = s.playerState || {};
      track.lastSnapshot = {
        playerState: p.playerState ?? track.lastSnapshot.playerState ?? null,
        currentAd: adIdentity(p.currentAd) ?? track.lastSnapshot.currentAd ?? null,
        isStuck: p.isStuck === true,
        appState: (s.appState && s.appState.state) || track.lastSnapshot.appState || null
      };
      const playing = config.playingStates.includes(track.lastSnapshot.playerState);
      track.timers.notPlayingSince = playing ? null
        : (track.timers.notPlayingSince == null ? t : track.timers.notPlayingSince);
      if (track.lastSnapshot.currentAd && track.lastSnapshot.currentAd !== track.timers.lastAdValue) {
        track.timers.lastAdValue = track.lastSnapshot.currentAd;
        track.timers.lastAdChangedAt = t;
      }
      if (track.lastSnapshot.isStuck) track.timers.lastStuckPulseAt = t;
    }
  }

  function buildCtx(track, t) {
    return {
      now: t,
      online: track.online,
      lastSeenAt: track.lastSeenAt,
      isPlaying: config.playingStates.includes(track.lastSnapshot.playerState),
      notPlayingSince: track.timers.notPlayingSince,
      lastAdChangedAt: track.timers.lastAdChangedAt,
      lastStuckPulseAt: track.timers.lastStuckPulseAt
    };
  }

  async function dispatch(kind, rule, track, t) {
    const device = await resolveDevice(track.deviceId);
    const ts = kind === 'ENTER'
      ? { detectedAt: new Date(t), lastSeenAt: track.lastSeenAt ? new Date(track.lastSeenAt) : null }
      : { recoveredAt: new Date(t), lastSeenAt: track.lastSeenAt ? new Date(track.lastSeenAt) : null,
          downForMs: track.incidents[rule].badSince ? t - track.incidents[rule].badSince : null };
    await emailer.sendDeviceAlert({
      kind, rule, device, snapshot: track.lastSnapshot, timestamps: ts, recipients: config.recipients
    });
    sendWindow.push(t);
  }

  async function tick(t = now(), connectivityOverride = null) {
    const states = getAllDeviceStates() || {};
    const connected = connectivityOverride || null;
    const ids = new Set([...Object.keys(states), ...store.deviceIds()]);
    const quiet = isQuietHours(new Date(t), config.quiet);
    const warming = (t - processStartedAt) < config.warmupMs;
    let entered = 0, recovered = 0;

    for (const deviceId of ids) {
      try {
        const track = store.getOrCreate(deviceId);
        const online = connected ? !!connected[deviceId] : isDeviceConnected(deviceId);
        updateTimers(track, states[deviceId], online, t);

        if (warming) { await store.persist(deviceId); continue; }

        const offlineFiring = track.incidents.OFFLINE.state === 'FIRING';

        for (const rule of RULE_IDS) {
          if (!config.rules[rule].enabled) continue;
          // Incident correlation: STOPPED/STUCK are meaningless while the device is
          // unreachable. Skip them whenever the device is offline OR offline is already
          // firing, so a previously-firing STOPPED/STUCK incident is left untouched (no
          // spurious RECOVER) during the window where OFFLINE is still pending.
          if ((rule === 'STOPPED' || rule === 'STUCK') && (!track.online || offlineFiring)) continue;

          const ctx = buildCtx(track, t);
          const isBad = predicate[rule](ctx, config);
          const budget = budgetAvailable(t);
          const allowEntry = config.enabled && !quiet && budget;
          const allowRecover = config.enabled && budget;
          // Observability: an alert that would have fired but is withheld solely by the rate cap.
          if (!budget) {
            const wantEntry = track.incidents[rule].state === 'OK' && isBad && config.enabled && !quiet;
            const wantRecover = track.incidents[rule].state === 'FIRING' && !isBad && config.enabled;
            if (wantEntry || wantRecover) {
              logger.warn(`[alerts] rate cap reached — withheld ${wantEntry ? 'ENTER' : 'RECOVER'} for ${deviceId}/${rule}`);
            }
          }
          const res = evaluate(track.incidents[rule], isBad, { now: t, allowEntry, allowRecover });

          if (res.action === 'ENTER') {
            try {
              await dispatch('ENTER', rule, track, t);
              track.incidents[rule] = res.incident;     // commit only after a successful send
              entered++;
            } catch (err) {
              logger.error(`[alerts] ENTER send failed for ${deviceId}/${rule}: ${err.message}`);
              // leave incident OK but preserve when it first went bad so the retry next tick is correct
              track.incidents[rule] = { ...track.incidents[rule], badSince: track.incidents[rule].badSince ?? t };
            }
          } else if (res.action === 'RECOVER') {
            try {
              await dispatch('RECOVER', rule, track, t);
              track.incidents[rule] = res.incident;
              recovered++;
            } catch (err) {
              logger.error(`[alerts] RECOVER send failed for ${deviceId}/${rule}: ${err.message}`);
            }
          } else {
            track.incidents[rule] = res.incident;
          }
        }
        await store.persist(deviceId);
      } catch (err) {
        logger.error(`[alerts] tick error for ${deviceId}: ${err.message}`);
      }
    }
    return { entered, recovered };
  }

  return {
    tick,
    start() {
      if (timer) return;
      logger.info(`[alerts] monitor started (enabled=${config.enabled}, scan=${config.scanIntervalMs}ms)`);
      timer = setInterval(() => { tick().catch(e => logger.error('[alerts] tick crash', e)); }, config.scanIntervalMs);
      if (timer.unref) timer.unref();
    },
    stop() { if (timer) { clearInterval(timer); timer = null; } }
  };
}

module.exports = { createMonitor };
