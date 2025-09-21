// AI Summary Card - Global Interactions
(function(){
  try {
    // slogan randomizer
    var header = document.querySelector('.ai-summary-dashed-container .ai-summary-slogan');
    if (header) {
      var slogans = [
        'AI已为您提炼精华',
        '智能摘要，一览无余',
        'AI为您总结，快速浏览',
        '高效阅读，从此开始',
        '本文核心，尽在掌握',
        'AI解读，省时省力',
        '精彩内容，快速预览'
      ];
      header.textContent = slogans[Math.floor(Math.random() * slogans.length)];
    }

    // typing effect
    var textSpan = document.querySelector('.ai-summary-dashed-container .ai-summary-text span');
    if (!textSpan) return;

    var fullText = textSpan.textContent || '';
    textSpan.textContent = '';
    textSpan.style.display = 'inline-block';

    var thinkingIndex = 0;
    var thinkingInterval = setInterval(function() {
      thinkingIndex = (thinkingIndex + 1) % 4;
      textSpan.textContent = '思考中' + '.'.repeat(thinkingIndex);
    }, 500);

    setTimeout(function() {
      clearInterval(thinkingInterval);
      textSpan.textContent = '';
      var i = 0;
      (function typer(){
        if (i < fullText.length) {
          textSpan.textContent += fullText.charAt(i++);
          setTimeout(typer, Math.random() * 50 + 20);
        }
      })();
    }, 800);
  } catch (e) { /* swallow */ }
})();