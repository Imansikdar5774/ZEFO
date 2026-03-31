// editor naam ka variable
let editor = document.getElementById("editor");
// run button variable 
let runBtn = document.getElementById("runBtn");
// output box variable 
let outputBox = document.getElementById("output-box");

// run button event

runBtn.addEventListener('click',() => {
  // code naam ka variable jaha value hoga editor
  let code = editor.value;
  // output box me dikhayega text ka contain editor ka
  outputBox.textContent = code;
})