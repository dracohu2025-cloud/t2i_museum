// 在浏览器控制台运行此脚本诊断图片提取问题
(function diagnoseImageExtraction() {
  const images = Array.from(document.images);
  
  console.log('=== 即梦页面图片诊断 ===');
  console.log('总图片数:', images.length);
  
  const allCandidates = images
    .filter(img => {
      const src = img.currentSrc || img.src;
      return src && !src.startsWith('data:');
    })
    .map(img => ({
      src: (img.currentSrc || img.src).slice(0, 100),
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      width: img.width,
      height: img.height,
      clientWidth: img.clientWidth,
      clientHeight: img.clientHeight,
      area: (img.naturalWidth || img.width || img.clientWidth || 0) * 
            (img.naturalHeight || img.height || img.clientHeight || 0)
    }))
    .sort((a, b) => b.area - a.area);
  
  console.log('所有候选图片（按面积排序）:');
  allCandidates.slice(0, 10).forEach((c, i) => {
    console.log(`${i + 1}. ${c.src}`);
    console.log(`   尺寸: natural=${c.naturalWidth}x${c.naturalHeight}, ` +
                `attr=${c.width}x${c.height}, ` +
                `client=${c.clientWidth}x${c.clientHeight}, ` +
                `area=${c.area}`);
  });
  
  // 当前提取到的图片
  console.log('\n=== 当前扩展提取逻辑结果 ===');
  
  // 模拟扩展的过滤逻辑
  function isLikelyThumbnail(src) {
    return /thumbnail|thumb[^b]|\bsmall\b|preview|mini|icon|avatar|\b\d{2,3}x\d{2,3}\b/i.test(src);
  }
  
  const filtered = allCandidates.filter(c => {
    if (isLikelyThumbnail(c.src)) {
      console.log('被 isLikelyThumbnail 过滤:', c.src.slice(0, 80));
      return false;
    }
    if (c.naturalWidth < 80 && c.width < 80 && c.clientWidth < 80) {
      console.log('被尺寸过滤:', c.src.slice(0, 80));
      return false;
    }
    return true;
  });
  
  console.log('\n过滤后剩余:', filtered.length, '张');
  console.log('最终选择（面积最大）:', filtered[0]?.src || '无');
  
  // 检查 prompt 元素
  const promptEl = document.querySelector('.prompt-value-container-lIP4pF') ||
                   document.querySelector('.prompt-value-text-cJL62n') ||
                   document.querySelector('.prompt-value-H7u3lm');
  console.log('\nPrompt 元素:', promptEl ? '找到' : '未找到');
  if (promptEl) {
    const rect = promptEl.getBoundingClientRect();
    console.log('Prompt 位置: top=' + rect.top + ', bottom=' + rect.bottom);
  }
})();