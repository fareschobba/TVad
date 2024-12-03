const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const uploadVideo = async (file, fileName) => {
  const { data, error } = await supabase.storage
    .from('advertisements')
    .upload(`videos/${fileName}`, file.buffer, {
      contentType: file.mimetype,
      cacheControl: '3600'
    });

  if (error) throw new Error(error.message);
  
  const { data: { publicUrl } } = supabase.storage
    .from('advertisements')
    .getPublicUrl(`videos/${fileName}`);

  return publicUrl;
};

const deleteVideo = async (fileName) => {
  const { error } = await supabase.storage
    .from('advertisements')
    .remove([`videos/${fileName}`]);

  if (error) throw new Error(error.message);
};

module.exports = { uploadVideo, deleteVideo };