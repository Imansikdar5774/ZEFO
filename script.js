// --- UI & MODALS LOGIC ---
function toggleMenu() { 
    document.getElementById("myDropdown").classList.toggle("show"); 
}

window.onclick = function(event) {
    if (!event.target.matches('.menu-btn')) {
        var dropdowns = document.getElementsByClassName("dropdown-content");
        for (var i = 0; i < dropdowns.length; i++) {
            if (dropdowns[i].classList.contains('show')) {
                dropdowns[i].classList.remove('show');
            }
        }
    }
}

function openModal(id) { 
    document.getElementById("myDropdown").classList.remove('show'); 
    document.getElementById(id).style.display = 'flex'; 
}

function closeModal(id) { 
    document.getElementById(id).style.display = 'none'; 
}

// --- VIRTUAL FILE SYSTEM LOGIC (0.0.16 FILE MANAGER) ---
let vfs = JSON.parse(localStorage.getItem('ds_vfs')) || {};

function openFileManager() {
    document.getElementById("myDropdown").classList.remove('show');
    renderFileList();
    document.getElementById('fm-modal').style.display = 'flex';
}

function renderFileList() {
    const listDiv = document.getElementById("fm-file-list");
    listDiv.innerHTML = "";
    let files = Object.keys(vfs);
    
    if(files.length === 0) {
        listDiv.innerHTML = "<p style='color:#a8a8b2;'>No files or folders created yet.</p>";
        return;
    }

    files.forEach(f => {
        let div = document.createElement("div");
        div.className = "fm-item";
        
        let isFolder = f.endsWith("/");
        let nameSpan = document.createElement("span");
        nameSpan.className = "fm-item-name";
        nameSpan.innerHTML = isFolder ? `📁 ${f}` : `📄 ${f}`;
        
        if(!isFolder) {
            nameSpan.onclick = () => {
                editor.setValue(vfs[f], -1);
                closeModal('fm-modal');
            };
        }

        let delBtn = document.createElement("button");
        delBtn.innerText = "❌";
        delBtn.style.background = "transparent";
        delBtn.style.border = "none";
        delBtn.style.cursor = "pointer";
        delBtn.onclick = () => {
            if(confirm(`Delete ${f}?`)){
                delete vfs[f];
                localStorage.setItem('ds_vfs', JSON.stringify(vfs));
                renderFileList();
            }
        };

        div.appendChild(nameSpan);
        div.appendChild(delBtn);
        listDiv.appendChild(div);
    });
}

function createNewFolder() {
    let fname = prompt("Enter Folder Name:");
    if (fname) {
        if(!fname.endsWith("/")) fname += "/";
        vfs[fname] = ""; 
        localStorage.setItem('ds_vfs', JSON.stringify(vfs));
        renderFileList();
    }
}

function createNewFile() {
    let fname = prompt("Enter File Name (e.g. app.ds or Folder/app.ds):", "new.ds");
    if (fname) {
        if (!fname.endsWith(".ds")) fname += ".ds";
        if (vfs[fname] && !confirm("File already exists. Overwrite?")) return;
        vfs[fname] = "";
        localStorage.setItem('ds_vfs', JSON.stringify(vfs));
        editor.setValue("", -1); // Load empty file into editor
        renderFileList();
        closeModal('fm-modal');
    }
}

function saveCurrentToFile() {
    let filename = prompt("Enter File name to save current code:", "main.ds");
    if (filename) {
        if (!filename.endsWith(".ds")) filename += ".ds";
        vfs[filename] = editor.getValue();
        localStorage.setItem('ds_vfs', JSON.stringify(vfs));
        renderFileList();
    }
}

// --- DOWNLOAD JS FILE LOGIC (Native Device Download) ---
function downloadJSFile(filename, content) {
    document.getElementById("myDropdown").classList.remove('show');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click(); // Triggers mobile File Manager download prompt
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// --- COMPILER (DEARSCRIPT TO JAVASCRIPT) ---
function convertToJS(code, isDom) {
    let jsCode = "// Compiled from DearScript v0.0.16\n(() => {\n";
    let rawCode = code.replace(/'''([\s\S]*?)'''/g, '/*$1*/').replace(/"""([\s\S]*?)"""/g, '/*$1*/');
    const lines = rawCode.split("\n");
    let indentStack = [];
    let lastVar = null; // Compiler track last var
    
    lines.forEach(l => {
        let clean = l.trim();
        let currentIndent = l.search(/\S|$/);
        
        while (indentStack.length > 0 && currentIndent <= indentStack[indentStack.length - 1]) {
            if (clean !== "else:") {
                jsCode += "    ".repeat(indentStack.length) + "}\n";
                indentStack.pop();
            } else { break; }
        }

        if (clean === "") { jsCode += "\n"; return; }
        if (clean.startsWith("//") || clean.startsWith("/*")) { jsCode += "    ".repeat(indentStack.length + 1) + clean + "\n"; return; }
        if (clean.startsWith("#")) { jsCode += "    ".repeat(indentStack.length + 1) + "//" + clean.substring(1) + "\n"; return; }

        if (clean.startsWith("if ") && clean.endsWith(":")) {
            let cond = clean.substring(3, clean.length - 1).trim();
            jsCode += "    ".repeat(indentStack.length + 1) + `if (${cond}) {\n`;
            indentStack.push(currentIndent);
        } else if (clean === "else:") {
            if (indentStack.length > 0) { jsCode += "    ".repeat(indentStack.length) + "} else {\n"; } 
            else { jsCode += "    } else {\n"; }
        } else if (clean.startsWith("mi ")) {
            let eqIdx = clean.indexOf('=');
            if (eqIdx !== -1) { lastVar = clean.substring(3, eqIdx).trim(); } // Store last var name
            jsCode += "    ".repeat(indentStack.length + 1) + clean.replace(/^mi\s+/, "let ") + "\n";
        } else if (clean.startsWith("not ") || clean.startsWith("not=")) { // NEW NOT COMPILER LOGIC
            let cleanNot = clean.substring(3).trim();
            let isSemi = cleanNot.endsWith(";");
            let core = isSemi ? cleanNot.slice(0, -1) : cleanNot;
            let eqIdx = core.indexOf('=');
            if(eqIdx !== -1) {
                let vName = core.substring(0, eqIdx).trim();
                let vVal = core.substring(eqIdx + 1).trim();
                let target = vName === "" ? lastVar : vName;
                jsCode += "    ".repeat(indentStack.length + 1) + target + " = " + vVal + (isSemi ? ";" : "") + "\n";
                lastVar = target;
            }
        } else if (clean.match(/^bik[\s\(\{\[]/)) {
            let val = clean.replace(/^bik/, "").trim();
            while ((val.startsWith("(") && val.endsWith(")")) || (val.startsWith("[") && val.endsWith("]")) || (val.startsWith("{") && val.endsWith("}"))) {
                val = val.substring(1, val.length - 1).trim();
            }
            if (isDom) { jsCode += "    ".repeat(indentStack.length + 1) + `document.write(${val});\n`; } 
            else { jsCode += "    ".repeat(indentStack.length + 1) + `console.log(${val});\n`; }
        } else {
            jsCode += "    ".repeat(indentStack.length + 1) + clean + "\n"; 
        }
    });
    
    while(indentStack.length > 0) {
        jsCode += "    ".repeat(indentStack.length) + "}\n";
        indentStack.pop();
    }
    jsCode += "})();\n";
    return jsCode;
}

// --- CLI TERMINAL LOGIC ---
function openCLI() {
    document.getElementById("myDropdown").classList.remove('show');
    document.getElementById('cli-modal').style.display = 'flex';
    document.getElementById('cli-input').focus();
}

function printCLI(text) {
    const out = document.getElementById('cli-output');
    out.innerHTML += "\n" + text; 
    out.scrollTop = out.scrollHeight;
}

function handleCLI(e) {
    if (e.key === 'Enter') {
        let input = e.target.value.trim();
        e.target.value = '';
        printCLI("> " + escapeHTML(input));
        
        if (input.startsWith("ds ")) {
            let parts = input.split(" ");
            let fname = parts[1];
            if (!fname.endsWith(".ds")) { fname += ".ds"; }

            if (parts.length >= 4 && parts[2] === "convert" && parts[3] === "js") {
                let isDom = (parts[4] === "dom");
                if (vfs[fname]) {
                    let jsContent = convertToJS(vfs[fname], isDom);
                    let jsFilename = fname.replace(".ds", ".js");
                    downloadJSFile(jsFilename, jsContent); // Native Download Trigger
                    printCLI(`Success: Compiled '${fname}' to JavaScript.`);
                    printCLI(`Opening Mobile File Manager to save '${jsFilename}'...`);
                } else {
                    printCLI(`<span style="color:#ff5555">Error: file '${fname}' not found.</span>`);
                }
            } else {
                if (vfs[fname]) {
                    let result = engineExecute(vfs[fname]);
                    let tempDiv = document.createElement("div");
                    tempDiv.innerHTML = result;
                    printCLI(escapeHTML(tempDiv.innerText));
                } else {
                    printCLI(`<span style="color:#ff5555">Error: file '${fname}' not found.</span>`);
                }
            }
        } else if (input === "ls") {
            let files = Object.keys(vfs);
            printCLI(files.length > 0 ? files.join("   ") : "No files saved.");
        } else if (input === "clear") {
            document.getElementById('cli-output').innerHTML = "Terminal cleared.";
        } else if (input !== "") {
            printCLI("Unknown command: '" + escapeHTML(input) + "'.");
        }
    }
}

// --- ACE EDITOR SETUP & HIGHLIGHTING ---
ace.define('ace/mode/ds_highlight_rules', function(require, exports, module) {
    var oop = require("ace/lib/oop");
    var TextHighlightRules = require("ace/mode/text_highlight_rules").TextHighlightRules;
    var dsHighlightRules = function() {
        this.$rules = {
            "start": [
                { token: "comment", regex: "//.*" }, 
                { token: "comment", regex: "#.*" },
                { token: "comment", regex: '"""', next: "qqstring" },
                { token: "comment", regex: "'''", next: "qstring" },
                { token: "keyword.bik", regex: "\\bbik\\b" }, 
                { token: "keyword.mi", regex: "\\b(?:mi|not)\\b" }, // UPDATED: ADDED 'not'
                { token: "keyword.ifelse", regex: "\\b(?:if|else)\\b" }, 
                { token: "constant.boolean", regex: "\\b(?:true|false)\\b" }, 
                { token: "keyword.detytype", regex: "\\b(?:type|dety)\\b" },
                { token: "keyword.reserved", regex: "\\b(?:float|string|list|array|intezar|str|floot|Boolean|bool)\\b" }, 
                { token: "string", regex: '"(?:[^"\\\\]|\\\\.)*"' }, 
                { token: "constant.numeric", regex: "[0-9]+" }
            ],
            "qqstring": [ { token: "comment", regex: '"""', next: "start" }, { defaultToken: "comment" } ],
            "qstring": [ { token: "comment", regex: "'''", next: "start" }, { defaultToken: "comment" } ]
        };
    };
    oop.inherits(dsHighlightRules, TextHighlightRules); 
    exports.dsHighlightRules = dsHighlightRules;
});

ace.define('ace/mode/dearscript', function(require, exports, module) {
    var oop = require("ace/lib/oop"); 
    var TextMode = require("ace/mode/text").Mode;
    var dsHighlightRules = require("ace/mode/ds_highlight_rules").dsHighlightRules;
    var CstyleBehaviour = require("ace/mode/behaviour/cstyle").CstyleBehaviour;
    
    var Mode = function() { 
        this.HighlightRules = dsHighlightRules; 
        this.$behaviour = new CstyleBehaviour(); 
    };
    oop.inherits(Mode, TextMode); 

    // --- AUTO-INDENT LOGIC (PYTHON STYLE) ---
    Mode.prototype.getNextLineIndent = function(state, line, tab) {
        var indent = this.$getIndent(line);
        if (line.match(/:[ \t]*$/)) {
            indent += tab;
        }
        return indent;
    };

    exports.Mode = Mode;
});

const editor = ace.edit("editor");
editor.setTheme("ace/theme/dracula");
editor.session.setMode("ace/mode/dearscript");
editor.setOptions({ 
    enableBasicAutocompletion: true, 
    enableLiveAutocompletion: true, 
    showPrintMargin: false, 
    behavioursEnabled: true 
});

// LOAD PERSISTENT AUTO-SAVE OR EMPTY
const savedCode = localStorage.getItem('ds_autosave') || "";
editor.setValue(savedCode, -1);

const langTools = ace.require("ace/ext/language_tools");
langTools.addCompleter({ 
    getCompletions: function(editor, session, pos, prefix, callback) { 
        callback(null, [ 
            {name:"bik", value:"bik", score:1000, meta: "Print"}, 
            {name:"mi", value:"mi", score:1000, meta: "Variable"},
            {name:"not", value:"not", score:1000, meta: "Reassign"}, // UPDATED: ADDED 'not'
            {name:"if", value:"if", score:1000, meta: "Condition"},
            {name:"else:", value:"else:", score:1000, meta: "Condition"},
            {name:"true", value:"true", score:1000, meta: "Boolean"},
            {name:"false", value:"false", score:1000, meta: "Boolean"},
            {name:"dety", value:"dety", score:1000, meta: "TypeCheck"},
            {name:"type", value:"type", score:1000, meta: "TypeCheck"},
            {name:"float", value:"float", score:1000, meta: "Reserved"},
            {name:"string", value:"string", score:1000, meta: "Reserved"},
            {name:"list", value:"list", score:1000, meta: "Reserved"},
            {name:"array", value:"array", score:1000, meta: "Reserved"},
            {name:"intezar", value:"intezar", score:1000, meta: "Reserved"},
            {name:"str", value:"str", score:1000, meta: "Reserved"},
            {name:"floot", value:"floot", score:1000, meta: "Reserved"},
            {name:"Boolean", value:"Boolean", score:1000, meta: "Reserved"},
            {name:"bool", value:"bool", score:1000, meta: "Reserved"}
        ]); 
    } 
});

// --- REAL-TIME LINTER & AUTO-SAVE ---
editor.session.on('change', function() {
    let code = editor.getValue();
    localStorage.setItem('ds_autosave', code); // Auto-save constantly

    let annotations = [];
    let lines = code.split('\n');
    lines.forEach((line, i) => {
        let clean = line.trim();
        // Check missing semi-colon for mi
        if (clean.startsWith('mi ') && !clean.endsWith(';')) {
            annotations.push({ row: i, column: 0, text: "Syntax Error: missing (;) at the end of variable.", type: "error" });
        }
        // Check missing colon for if
        if (clean.startsWith('if ') && !clean.endsWith(':')) {
            annotations.push({ row: i, column: 0, text: "Syntax Error: missing ':' at the end of 'if' condition.", type: "error" });
        }
        // Check missing semi-colon for not (NEW LINTER RULE)
        if ((clean.startsWith('not ') || clean.startsWith('not=')) && !clean.endsWith(';')) {
            annotations.push({ row: i, column: 0, text: "Syntax Error: missing (;) at the end of 'not' statement.", type: "error" });
        }
    });
    editor.session.setAnnotations(annotations); // Shows red (!) in editor margin
});

// --- HELPER FUNCTIONS ---
function escapeHTML(str) { 
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); 
}

function removeInlineComments(text) {
    return text.replace(/(".*?"|'.*?')|(\/\/.*|#.*)/g, (match, stringLiteral) => stringLiteral ? stringLiteral : "").trimEnd();
}

// --- THE MASTER DEARSCRIPT ENGINE v0.0.16 ---
function engineExecute(code) {
    let rawCode = code.replace(/"""[\s\S]*?"""/g, '').replace(/'''[\s\S]*?'''/g, '');
    const lines = rawCode.split("\n");
    let output = ""; 
    let memory = {};
    const reservedKw = ["bik", "mi", "not", "dety", "type", "float", "string", "list", "array", "intezar", "str", "floot", "Boolean", "bool", "if", "else", "true", "false"];
    
    let skipMode = false;
    let baseIndent = 0;
    let lastIfResult = false;
    let hasActiveIf = false;
    let lastVar = null; // NEW: TRACKS THE LAST DECLARED VARIABLE FOR ANONYMOUS 'NOT'

    let regexCache = {};

    for (let i = 0; i < lines.length; i++) {
        let rawLine = lines[i];
        let clean = removeInlineComments(rawLine).trimStart();
        let indentMatch = rawLine.match(/^\s*/);
        let indent = indentMatch ? indentMatch[0].length : 0;
        
        if (clean === "") continue; 
        
        if (indent <= baseIndent && clean !== "else:") {
            skipMode = false;
            hasActiveIf = false;
        }

        if (skipMode && indent > baseIndent) {
            continue; 
        }
        
        if (clean.startsWith("if ") && clean.endsWith(":")) {
            let condition = clean.substring(3, clean.length - 1).trim();
            let evalString = condition;
            let keys = Object.keys(memory).sort((a, b) => b.length - a.length);
            
            keys.forEach(k => { 
                if (!regexCache[k]) { regexCache[k] = new RegExp('(".*?"|\'.*?\')|\\b' + k + '\\b', 'g'); }
                evalString = evalString.replace(regexCache[k], (match, isString) => {
                    if (isString) return match;
                    return typeof memory[k] === 'string' ? `"${memory[k]}"` : JSON.stringify(memory[k]);
                });
            });
            
            try { lastIfResult = !!(new Function('return ' + evalString)()); } 
            catch(e) { output += `<span class="error-text">Condition Error in 'if'</span>\n`; lastIfResult = false; }

            baseIndent = indent;
            hasActiveIf = true;
            skipMode = !lastIfResult; 
            continue;
        }

        if (clean === "else:") {
            if (!hasActiveIf) {
                output += `<span class="error-text">Syntax Error: 'else:' without preceding 'if:'</span>\n`;
                continue;
            }
            baseIndent = indent;
            hasActiveIf = false;
            skipMode = lastIfResult; 
            continue;
        }

        // --- NEW 'NOT' KEYWORD LOGIC BLOCK ---
        if (clean.startsWith("not ") || clean.startsWith("not=")) {
            if (!clean.endsWith(";")) { 
                output += `<span class="error-text">Syntax Error: missing (;) at the end of 'not' statement.</span>\n`; 
                continue; 
            }
            
            let assignment = clean.substring(3, clean.length - 1).trim(); 
            let eqIndex = assignment.indexOf('=');
            
            if (eqIndex === -1) { 
                output += `<span class="error-text">Syntax Error: missing '=' in 'not' declaration.</span>\n`; 
                continue; 
            }
            
            let varName = assignment.substring(0, eqIndex).trim();
            let varValue = assignment.substring(eqIndex + 1).trim();
            
            // SMART DETECT: If no name given, use the last declared variable!
            let targetVar = (varName === "") ? lastVar : varName;

            if (!targetVar) {
                output += `<span class="error-text">Error: No previous variable found to update for anonymous 'not'.</span>\n`;
                continue;
            }
            
            if (varName !== "" && !/^[a-zA-Z_]\w*$/.test(varName)) { 
                output += `<span class="error-text">Syntax Error: invalid variable name '${varName}'</span>\n`; 
                continue; 
            }
            if (varName !== "" && reservedKw.includes(varName)) {
                output += `<span class="error-text">Syntax Error: '${varName}' is a reserved keyword.</span>\n`;
                continue;
            }

            // Value Parsing (Same powerful logic as 'mi')
            if (varValue.startsWith('"') && varValue.endsWith('"')) {
                memory[targetVar] = varValue.slice(1, -1).replace(/\\"/g, '"'); 
            } 
            else if (varValue === "true" || varValue === "false") {
                memory[targetVar] = (varValue === "true");
            }
            else if (varValue.startsWith('[') && varValue.endsWith(']')) {
                try { 
                    let jsonSafe = varValue.replace(/(?:^|\[|,)\s*'([^'\\]*(?:\\.[^'\\]*)*)'\s*(?=\]|,)/g, function(m, p1) { return m.replace(/'/g, '"'); });
                    memory[targetVar] = JSON.parse(jsonSafe); 
                } catch(e) { 
                    output += `<span class="error-text">Array Syntax Error in 'not'.</span>\n`; 
                }
            } 
            else {
                let evalString = varValue;
                let keys = Object.keys(memory).sort((a, b) => b.length - a.length);
                
                keys.forEach(k => { 
                    if (!regexCache[k]) { regexCache[k] = new RegExp('(".*?"|\'.*?\')|\\b' + k + '\\b', 'g'); }
                    evalString = evalString.replace(regexCache[k], (match, isString) => {
                        if (isString) return match;
                        return typeof memory[k] === 'string' ? `"${memory[k]}"` : JSON.stringify(memory[k]);
                    });
                });
                
                if (/^[\d\s\+\-\*\/\(\)\.\>\<\=\!\&\|\%]+$/.test(evalString) && evalString !== "") {
                    try { memory[targetVar] = new Function('return ' + evalString)(); } 
                    catch (e) { output += `<span class="error-text">Math/Logic Error in 'not' variable '${targetVar}'</span>\n`; }
                } else if (/^".*"$/.test(evalString)) {
                    memory[targetVar] = evalString.slice(1, -1);
                } else { 
                    output += `<span class="error-text">Syntax Error: unsupported value in 'not'</span>\n`; 
                }
            }
            lastVar = targetVar; // Update last accessed variable
            continue; 
        }

        if (clean.startsWith("mi ")) {
            if (!clean.endsWith(";")) { 
                output += `<span class="error-text">Syntax Error: missing (;) at the end of variable.</span>\n`; 
                continue; 
            }
            
            let assignment = clean.substring(3, clean.length - 1).trim(); 
            let eqIndex = assignment.indexOf('=');
            
            if (eqIndex === -1) { 
                output += `<span class="error-text">Syntax Error: missing '=' in declaration.</span>\n`; 
                continue; 
            }
            
            let varName = assignment.substring(0, eqIndex).trim();
            let varValue = assignment.substring(eqIndex + 1).trim();
            
            if (!/^[a-zA-Z_]\w*$/.test(varName)) { 
                output += `<span class="error-text">Syntax Error: invalid variable name '${varName}'</span>\n`; 
                continue; 
            }
            if (reservedKw.includes(varName)) {
                output += `<span class="error-text">Syntax Error: '${varName}' is a reserved keyword and cannot be used as a variable name.</span>\n`;
                continue;
            }

            if (varValue.startsWith('"') && varValue.endsWith('"')) {
                memory[varName] = varValue.slice(1, -1).replace(/\\"/g, '"'); 
            } 
            else if (varValue === "true" || varValue === "false") {
                memory[varName] = (varValue === "true");
            }
            else if (varValue.startsWith('[') && varValue.endsWith(']')) {
                try { 
                    let jsonSafe = varValue.replace(/(?:^|\[|,)\s*'([^'\\]*(?:\\.[^'\\]*)*)'\s*(?=\]|,)/g, function(m, p1) { return m.replace(/'/g, '"'); });
                    memory[varName] = JSON.parse(jsonSafe); 
                } catch(e) { 
                    output += `<span class="error-text">Array Syntax Error: Invalid format.</span>\n`; 
                }
            } 
            else {
                let evalString = varValue;
                let keys = Object.keys(memory).sort((a, b) => b.length - a.length);
                
                keys.forEach(k => { 
                    if (!regexCache[k]) { regexCache[k] = new RegExp('(".*?"|\'.*?\')|\\b' + k + '\\b', 'g'); }
                    evalString = evalString.replace(regexCache[k], (match, isString) => {
                        if (isString) return match;
                        return typeof memory[k] === 'string' ? `"${memory[k]}"` : JSON.stringify(memory[k]);
                    });
                });
                
                if (/^[\d\s\+\-\*\/\(\)\.\>\<\=\!\&\|\%]+$/.test(evalString) && evalString !== "") {
                    try { memory[varName] = new Function('return ' + evalString)(); } 
                    catch (e) { output += `<span class="error-text">Math/Logic Error in variable '${varName}'</span>\n`; }
                } else if (/^".*"$/.test(evalString)) {
                    memory[varName] = evalString.slice(1, -1);
                } else { 
                    output += `<span class="error-text">Syntax Error: unsupported value for '${varName}'</span>\n`; 
                }
            }
            lastVar = varName; // TRACK VARIABLE FOR FUTURE ANONYMOUS 'NOT'
            continue; 
        }
        
        else if (clean.match(/^bik([\s\(\{\[]|$)/)) {
            let val = clean.replace(/^bik/, "").trim(); 
            
            if (val === "" || val === "()" || val === "[]" || val === "{}") {
                output += "\n";
                continue;
            }

            while ((val.startsWith("(") && val.endsWith(")")) || (val.startsWith("[") && val.endsWith("]")) || (val.startsWith("{") && val.endsWith("}"))) {
                val = val.substring(1, val.length - 1).trim();
            }

            let detyMatch = val.match(/^dety\s*\(\s*(.*?)\s*\)$/) || (val.startsWith("dety ") ? [null, val.replace(/^dety\s*/, "")] : null);
            let typeMatch = val.match(/^type\s*\(\s*(.*?)\s*\)$/) || (val.startsWith("type ") ? [null, val.replace(/^type\s*/, "")] : null);

            if (detyMatch) {
                let varNameToCheck = detyMatch[1].trim();
                if (memory.hasOwnProperty(varNameToCheck)) {
                    let memVal = memory[varNameToCheck];
                    if (Array.isArray(memVal)) output += "array\n";
                    else if (typeof memVal === 'boolean') output += "boolean\n";
                    else if (typeof memVal === 'number' && memVal % 1 === 0) output += "integer\n";
                    else if (typeof memVal === 'number' && memVal % 1 !== 0) output += "float\n";
                    else if (typeof memVal === 'string') output += "string\n";
                } else { output += `<span class="error-text">Reference Error: '${varNameToCheck}' not defined.</span>\n`; }
                continue;
            }

            if (typeMatch) {
                let varNameToCheck = typeMatch[1].trim();
                if (memory.hasOwnProperty(varNameToCheck)) {
                    let memVal = memory[varNameToCheck];
                    if (Array.isArray(memVal)) output += "class: list\n";
                    else if (typeof memVal === 'boolean') output += "class: bool\n";
                    else if (typeof memVal === 'number' && memVal % 1 === 0) output += "class: int\n";
                    else if (typeof memVal === 'number' && memVal % 1 !== 0) output += "class: float\n";
                    else if (typeof memVal === 'string') output += "class: str\n";
                } else { output += `<span class="error-text">Reference Error: '${varNameToCheck}' not defined.</span>\n`; }
                continue;
            }

            if (val.startsWith('"') && (!val.endsWith('"') || val === '""')) {
                if(val === '""') { output += "\n"; } else { output += `<span class="error-text">Syntax Error: missing (").</span>\n`; }
            } 
            else if (val.startsWith('"') && val.endsWith('"') && val.length >= 2) {
                let innerText = val.slice(1, -1).replace(/\\"/g, '"'); 
                output += escapeHTML(innerText) + "\n";
            } 
            else if (val === "true" || val === "false") {
                output += escapeHTML(val) + "\n";
            }
            else if (memory.hasOwnProperty(val)) {
                if (Array.isArray(memory[val])) { output += escapeHTML(JSON.stringify(memory[val])) + "\n"; } 
                else { output += escapeHTML(String(memory[val])) + "\n"; }
            } 
            else {
                let evalString = val;
                let keys = Object.keys(memory).sort((a, b) => b.length - a.length);
                
                keys.forEach(k => { 
                    if (!regexCache[k]) { regexCache[k] = new RegExp('(".*?"|\'.*?\')|\\b' + k + '\\b', 'g'); }
                    evalString = evalString.replace(regexCache[k], (match, isString) => {
                        if (isString) return match; 
                        return memory[k]; 
                    });
                });

                let undefinedVars = evalString.match(/[a-zA-Z_]\w*/g);
                if (undefinedVars) {
                    output += `<span class="error-text">Reference Error: '${undefinedVars[0]}' is not defined.</span>\n`;
                    continue;
                }

                if (/^[\d\s\+\-\*\/\(\)\.\>\<\=\!\&\|\%]+$/.test(evalString) && evalString !== "") {
                    if (/[\+\-\*\/\%]{2,}/.test(evalString.replace(/\s+/g,''))) { output += `<span class="error-text">Math Error</span>\n`; } 
                    else { 
                        try { output += new Function('return ' + evalString)() + "\n"; } 
                        catch (e) { output += `<span class="error-text">Math/Logic Error</span>\n`; } 
                    }
                } else { 
                    output += `<span class="error-text">Syntax Error: Invalid expression.</span>\n`; 
                }
            }
        } 
        else { 
            output += `<span class="error-text">Syntax Error: invalid syntax.</span>\n`; 
        }
    }
    
    return output || "Process Finished.";
}

// --- EXECUTE FROM UI BUTTON ---
function runDirectly() {
    let result = engineExecute(editor.getValue());
    document.getElementById("out").innerHTML = result;
    document.getElementById("terminal").style.display = "flex";
}
