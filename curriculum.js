/* Small, fixed Traditional Chinese curriculum. Tone 1 is confirmed with Space. */
const WORDS = Object.entries(WORD_GROUPS).flatMap(([group,{entries}])=>entries.map(([text,zhuyin,tone])=>({text,zhuyin,tone,group})));
const WORD_BY_TEXT = Object.fromEntries(WORDS.map(word=>[word.text,word]));
const TONE_SYMBOLS = {1:' ',2:'ˊ',3:'ˇ',4:'ˋ',5:'˙'};
function wordReading(word){return word.zhuyin+(word.tone===1?'':TONE_SYMBOLS[word.tone])}
