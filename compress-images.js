const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Configuration for compression
const compressionOptions = {
  quality: 80,              // JPEG/WebP quality 
  maxWidth: 1920,           // Max width
  maxHeight: 1080,          // Max height
  targetSizeKB: 300         // Target max 300KB per image
};

const backgroundsDir = path.join(__dirname, 'src', 'assets', 'backgrounds');
const originalBackupsDir = path.join(backgroundsDir, 'originals');

async function compressImage(filePath, fileName) {
  try {
    console.log(`\n🔄 Processing: ${fileName}`);
    
    // Get original file stats
    const originalStats = fs.statSync(filePath);
    const originalSizeMB = (originalStats.size / (1024 * 1024)).toFixed(2);
    console.log(`   Original size: ${originalSizeMB}MB`);
    
    // Skip if already small enough
    if (originalStats.size < 200 * 1024) { // Less than 200KB
      console.log(`   ✅ Already optimized (${originalSizeMB}MB < 0.2MB)`);
      return;
    }

    // Create originals directory if it doesn't exist
    if (!fs.existsSync(originalBackupsDir)) {
      fs.mkdirSync(originalBackupsDir, { recursive: true });
    }
    
    // Backup original if not already backed up
    const originalBackupPath = path.join(originalBackupsDir, fileName);
    if (!fs.existsSync(originalBackupPath)) {
      fs.copyFileSync(filePath, originalBackupPath);
      console.log(`   💾 Backed up original to: originals/${fileName}`);
    }

    // Get image info
    const image = sharp(filePath);
    const metadata = await image.metadata();
    
    console.log(`   Dimensions: ${metadata.width}x${metadata.height}`);
    
    // Start with base compression
    let sharpInstance = image
      .resize({
        width: compressionOptions.maxWidth,
        height: compressionOptions.maxHeight,
        fit: 'inside',
        withoutEnlargement: true
      });
    
    // Determine output format and apply compression
    const ext = path.extname(fileName).toLowerCase();
    let compressedBuffer;
    
    if (ext === '.png') {
      // For PNG, try WebP first for better compression, fallback to optimized PNG
      try {
        compressedBuffer = await sharpInstance
          .webp({ quality: compressionOptions.quality, effort: 6 })
          .toBuffer();
        
        // If WebP is larger than PNG, use optimized PNG
        const pngBuffer = await sharp(filePath)
          .resize({
            width: compressionOptions.maxWidth,
            height: compressionOptions.maxHeight,
            fit: 'inside',
            withoutEnlargement: true
          })
          .png({ 
            compressionLevel: 9,
            palette: true,
            quality: compressionOptions.quality,
            progressive: true
          })
          .toBuffer();
          
        if (pngBuffer.length < compressedBuffer.length) {
          compressedBuffer = pngBuffer;
        } else {
          // Keep WebP format but rename file
          const webpFileName = fileName.replace(/\.png$/i, '.webp');
          const webpPath = path.join(backgroundsDir, webpFileName);
          
          fs.writeFileSync(webpPath, compressedBuffer);
          
          // Update the original file to point to WebP (for now, we'll keep PNG for compatibility)
          compressedBuffer = pngBuffer;
        }
      } catch {
        // Fallback to optimized PNG
        compressedBuffer = await sharpInstance
          .png({ 
            compressionLevel: 9,
            palette: true,
            quality: compressionOptions.quality
          })
          .toBuffer();
      }
    } else {
      // For JPEG, use JPEG compression
      compressedBuffer = await sharpInstance
        .jpeg({ 
          quality: compressionOptions.quality,
          progressive: true,
          mozjpeg: true
        })
        .toBuffer();
    }
    
    // If still too large, reduce quality further
    if (compressedBuffer.length > compressionOptions.targetSizeKB * 1024) {
      console.log(`   🔧 Still too large, reducing quality further...`);
      
      let quality = compressionOptions.quality - 10;
      while (quality > 30 && compressedBuffer.length > compressionOptions.targetSizeKB * 1024) {
        if (ext === '.png') {
          compressedBuffer = await sharp(filePath)
            .resize({
              width: compressionOptions.maxWidth,
              height: compressionOptions.maxHeight,
              fit: 'inside',
              withoutEnlargement: true
            })
            .png({ 
              compressionLevel: 9,
              palette: true,
              quality: quality
            })
            .toBuffer();
        } else {
          compressedBuffer = await sharp(filePath)
            .resize({
              width: compressionOptions.maxWidth,
              height: compressionOptions.maxHeight,
              fit: 'inside',
              withoutEnlargement: true
            })
            .jpeg({ 
              quality: quality,
              progressive: true,
              mozjpeg: true
            })
            .toBuffer();
        }
        quality -= 10;
      }
    }
    
    const compressedSizeMB = (compressedBuffer.length / (1024 * 1024)).toFixed(2);
    const compressedSizeKB = Math.round(compressedBuffer.length / 1024);
    const reductionPercent = Math.round((1 - compressedBuffer.length / originalStats.size) * 100);
    
    // Write compressed image
    fs.writeFileSync(filePath, compressedBuffer);
    
    console.log(`   ✅ Compressed: ${originalSizeMB}MB → ${compressedSizeMB}MB (${compressedSizeKB}KB) - ${reductionPercent}% reduction`);
    
  } catch (error) {
    console.error(`   ❌ Error compressing ${fileName}:`, error.message);
  }
}

async function compressAllImages() {
  console.log('🖼️  Starting image compression process...\n');
  
  if (!fs.existsSync(backgroundsDir)) {
    console.error('❌ Backgrounds directory not found:', backgroundsDir);
    process.exit(1);
  }

  const files = fs.readdirSync(backgroundsDir)
    .filter(file => /\.(png|jpg|jpeg)$/i.test(file))
    .sort();

  if (files.length === 0) {
    console.log('⚠️  No image files found to compress');
    return;
  }

  console.log(`📁 Found ${files.length} images to process`);
  
  let totalOriginalSize = 0;
  let totalCompressedSize = 0;
  
  // Calculate initial total size
  files.forEach(file => {
    const filePath = path.join(backgroundsDir, file);
    const stats = fs.statSync(filePath);
    totalOriginalSize += stats.size;
  });

  for (const file of files) {
    const filePath = path.join(backgroundsDir, file);
    await compressImage(filePath, file);
  }
  
  // Calculate final total size
  files.forEach(file => {
    const filePath = path.join(backgroundsDir, file);
    const stats = fs.statSync(filePath);
    totalCompressedSize += stats.size;
  });
  
  const totalOriginalMB = (totalOriginalSize / (1024 * 1024)).toFixed(2);
  const totalCompressedMB = (totalCompressedSize / (1024 * 1024)).toFixed(2);
  const totalReductionPercent = Math.round((1 - totalCompressedSize / totalOriginalSize) * 100);
  
  console.log(`\n📊 COMPRESSION SUMMARY:`);
  console.log(`   Total original size: ${totalOriginalMB}MB`);
  console.log(`   Total compressed size: ${totalCompressedMB}MB`);
  console.log(`   Total reduction: ${totalReductionPercent}% (saved ${(totalOriginalSize - totalCompressedSize) / (1024 * 1024)} MB)`);
  console.log(`   Original images backed up to: ${path.relative(__dirname, originalBackupsDir)}`);
  console.log(`\n✅ Image compression completed!`);
}


// Run compression
compressAllImages().catch(console.error);