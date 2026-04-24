// editor naam ka variable
let editor = document.getElementById("editor");
// run button variable 
let runBtn = document.getElementById("runBtn");
// output box variable 
let outputBox = document.getElementById("output-box");

// run button event

runBtn.addEventListener('click',() => {
  // code naam ka variable jaha value hoga editor
  let code = editor.value.trim();

  // agar code bik se suru hota hei to tab output me value ata hei
  if (code.startsWith('bik')) {
    outputBox.textContent = code.substring(4).trim();
    // isme iska color hoga black
  }
  // agar ulta sidha code ho to error feek ke marega
  else {
    outputBox.textContent = "sintax error: invalid sintax";
    // error ka color hei red
    outputBox.style.color = "red";
  }
})  