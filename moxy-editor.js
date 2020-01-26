/**
 * Copyright (C) 2020 Daniel Moxon
 * https://github.com/dcmox/moxyeditor
 */
var REGEX_HTML_CHARS = /[&<>"']/g;
var HTML_CHAR_MAP = {
    '"': '&quot;',
    '&': '&amp;',
    '\'': '&#039;',
    '<': '&lt;',
    '>': '&gt;',
    '`': '&#x60;'
};
var escapeChars = function (s) { return s.replace(/[^a-zA-Z0-9]/g, function (m) { return '\\' + m; }); };
var notMatched = function (match) { return new RegExp('([^\>])(' + escapeChars(match) + ')([^\<])', 'g'); };
var decodeHTML = function (html) { return html.replace(REGEX_HTML_CHARS, function (m) { return HTML_CHAR_MAP[m]; }); };
var ASCII_AUTOCOMPLETE_MAP = {
    123: '\}',
    40: ')',
    91: ']'
};
var MoxyEditor = /** @class */ (function () {
    function MoxyEditor(editorId, options) {
        var _this = this;
        this._id = 0;
        this._lineCount = 0;
        this._spacesToTab = function (str) { return str.replace(/    /g, '\t'); };
        this._getSelectedText = function () {
            var text;
            if (window.getSelection) {
                text = window.getSelection().toString();
            }
            else if (document.selection && document.selection.type !== 'Control') {
                text = document.selection.createRange().text;
            }
            return text;
        };
        this._getCaretCharOffset = function (element) {
            var caretOffset = 0;
            if (window.getSelection) {
                var range = window.getSelection().getRangeAt(0);
                var preCaretRange = range.cloneRange();
                preCaretRange.selectNodeContents(element);
                preCaretRange.setEnd(range.endContainer, range.endOffset);
                caretOffset = preCaretRange.toString().length;
            }
            else if (document.selection && document.selection.type !== 'Control') {
                var textRange = document.selection.createRange();
                var preCaretTextRange = document.body.createTextRange();
                preCaretTextRange.moveToElementText(element);
                preCaretTextRange.setEndPoint('EndToEnd', textRange);
                caretOffset = preCaretTextRange.text.length;
            }
            return caretOffset;
        };
        // Get offset of a line with tab consideration
        this._getOffset = function (currentLine, previousLine) {
            var offset = currentLine ? _this._getCaretCharOffset(currentLine) : 0;
            while (true) {
                if (previousLine.innerText.substring(offset) !== '\t') {
                    break;
                }
                offset++;
            }
            return offset;
        };
        // Courtesy of https://jsfiddle.net/8mdX4/1211/
        this._getTextNodesIn = function (node) {
            var textNodes = [];
            if (node.nodeType === 3) {
                textNodes.push(node);
            }
            else {
                var children = node.childNodes;
                for (var i = 0, len = children.length; i < len; ++i) {
                    textNodes.push.apply(textNodes, _this._getTextNodesIn(children[i]));
                }
            }
            return textNodes;
        };
        this._setSelectionRange = function (el, start, end) {
            if (document.createRange && window.getSelection) {
                var range = document.createRange();
                range.selectNodeContents(el);
                var textNodes = _this._getTextNodesIn(el);
                var foundStart = false;
                var charCount = 0;
                var endCharCount = void 0;
                var foundEnd = false;
                // tslint:disable-next-line: no-conditional-assignment
                for (var i = 0, textNode = void 0; textNode = textNodes[i++];) {
                    endCharCount = charCount + textNode.length;
                    if (!foundStart && start >= charCount
                        && (start < endCharCount ||
                            (start === endCharCount && i <= textNodes.length))) {
                        range.setStart(textNode, start - charCount);
                        foundStart = true;
                    }
                    if (foundStart && end <= endCharCount) {
                        foundEnd = true;
                        range.setEnd(textNode, end - charCount);
                        break;
                    }
                    charCount = endCharCount;
                }
                if (!foundEnd) {
                    range.setEnd(textNodes[textNodes.length - 1], textNodes[textNodes.length - 1].textContent.length);
                }
                var sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
            }
            else if (document.selection && document.body.createTextRange) {
                var textRange = document.body.createTextRange();
                textRange.moveToElementText(el);
                textRange.collapse(true);
                textRange.moveEnd('character', end);
                textRange.moveStart('character', start);
                textRange.select();
            }
        };
        this._isEditable = function () { return _this._lines.querySelector('.line pre').contentEditable === 'true'; };
        this._selectAll = function (flag) {
            if (flag === void 0) { flag = 'enable'; }
            if (flag === 'enable') {
                _this._lines.querySelectorAll('.line pre').forEach(function (line) { return line.contentEditable = 'false'; });
                _this._editor.focus();
            }
            else {
                if (!_this._isEditable()) {
                    _this._lines.querySelectorAll('.line pre').forEach(function (line) { return line.contentEditable = 'true'; });
                }
            }
        };
        // Courtesy of https://jsfiddle.net/nrx9yvw9/5/
        this._createRange = function (node, chars, range) {
            if (!range) {
                range = document.createRange();
                range.selectNode(node);
                range.setStart(node, 0);
            }
            if (chars.count === 0) {
                range.setEnd(node, chars.count);
            }
            else if (node && chars.count > 0) {
                if (node.nodeType === Node.TEXT_NODE) {
                    if (node.textContent.length < chars.count) {
                        chars.count -= node.textContent.length;
                    }
                    else {
                        range.setEnd(node, chars.count);
                        chars.count = 0;
                    }
                }
                else {
                    // tslint:disable-next-line: prefer-for-of
                    for (var lp = 0; lp < node.childNodes.length; lp++) {
                        range = _this._createRange(node.childNodes[lp], chars, range);
                        if (chars.count === 0) {
                            break;
                        }
                    }
                }
            }
            return range;
        };
        this._setCurrentCursorPosition = function (element, chars) {
            if (chars >= 0) {
                var selection = window.getSelection();
                var range = _this._createRange(element.parentNode, { count: chars });
                if (range) {
                    range.collapse(false);
                    selection.removeAllRanges();
                    selection.addRange(range);
                }
            }
        };
        this._editor = document.querySelector("#" + editorId);
        this._init();
        this._lines = this._editor.querySelector('.lines');
        this._lineNos = this._editor.querySelector('.lineNo');
        this._setup();
        if (!options) {
            this._options = {
                autoBraces: true,
                autoHtmlTags: true
            };
        }
        else {
            this._options = options;
        }
    }
    MoxyEditor.prototype._init = function () {
        this._editor.classList.add('moxyEditor');
        var lineNo = document.createElement('div');
        lineNo.classList.add('lineNo');
        var lines = document.createElement('div');
        lines.classList.add('lines');
        this._editor.appendChild(lineNo);
        this._editor.appendChild(lines);
    };
    MoxyEditor.prototype._setup = function () {
        this._addLine();
        this._addEvents();
    };
    MoxyEditor.prototype._handlePaste = function (e, element) {
        // Stop data actually being pasted into div
        e.stopPropagation();
        e.preventDefault();
        // Get pasted data via clipboard API
        var clipboardData = e.clipboardData || window.clipboardData;
        var pastedData = clipboardData.getData('text');
        // Clean our data
        var div = document.createElement('div');
        div.innerHTML = pastedData;
        var lines = div.innerText.split('\n');
        element.innerHTML = this._spacesToTab(lines[0]);
        // Add lines
        this._colorizeLine(element, '');
        for (var i = 1; i < lines.length; i++) {
            var element_1 = this._addLine();
            element_1.innerHTML = this._spacesToTab(lines[i]);
            this._colorizeLine(element_1, '');
        }
    };
    MoxyEditor.prototype._addLine = function (focus, insertAfterLine) {
        var _this = this;
        if (focus === void 0) { focus = false; }
        var div = document.createElement('div');
        var pre = document.createElement('pre');
        pre.contentEditable = 'true';
        pre.spellcheck = false;
        pre.onpaste = function (e) { return _this._handlePaste(e, pre); };
        div.innerHTML = '';
        div.className = 'line';
        div.dataset.id = (++this._id).toString();
        var tabCount = 0;
        if (insertAfterLine && insertAfterLine.innerHTML.indexOf('\t') > -1) {
            tabCount = insertAfterLine.innerHTML.split('\t').length;
            pre.innerHTML = new Array(tabCount - 1).fill('\t').join('');
        }
        div.appendChild(pre);
        this._lineCount++;
        div.tabIndex = 0;
        this._addLineNo();
        if (insertAfterLine) {
            insertAfterLine.insertAdjacentElement('afterend', div);
        }
        else {
            this._lines.append(div);
        }
        pre.onkeypress = function (e) { return _this._handleKeyPress(e); };
        pre.onkeydown = function (e) { return _this._handleKeyDown(e); };
        pre.onclick = function (e) { return _this._handleLineClickFromPre(e); };
        if (focus === true) {
            pre.click();
            pre.focus();
            if (tabCount) {
                this._colorizeLine(pre, '');
            }
        }
        return pre;
    };
    MoxyEditor.prototype._addLineNo = function () {
        var span = document.createElement('span');
        span.dataset.lineNo = this._lineCount.toString();
        span.innerHTML = this._lineCount.toString();
        this._lineNos.append(span);
    };
    MoxyEditor.prototype._addEvents = function () {
        var _this = this;
        this._editor.onclick = function () {
            var offset = _this._getOffset(null, _this._lines.querySelector('div.line:last-child'));
            _this._setActiveLine(_this._lines.querySelector('div.line:last-child').dataset.id, offset);
            _this._selectAll('disable');
        };
        this._editor.oncut = function (e) {
            _this._editorAction = 'cut';
            document.execCommand('copy');
        };
        window.onkeyup = function (e) {
            if (e.which === 8 && !_this._isEditable()) {
                _this._clearEditor();
                _this._selectAll('disable');
                _this._setActiveLine('1');
            }
        };
        this._editor.oncopy = function (e) {
            if (_this._editorAction === 'cut') {
                var text = _this._getSelectedText();
                e.clipboardData.setData('text', text);
                _this._editorAction = '';
                _this._clearEditor();
                e.preventDefault();
            }
        };
    };
    MoxyEditor.prototype._clearEditor = function () {
        var lines = this._lines.querySelectorAll('.line');
        for (var i = lines.length - 1; i > 0; i--) {
            this._removeLine(lines[i].dataset.id, false);
        }
        lines[0].querySelector('pre').innerText = '';
    };
    MoxyEditor.prototype._handleLineClickFromPre = function (e) {
        if (!e.target.parentElement.dataset.id) {
            return;
        }
        this._prevLine = this._activeLine;
        this._activeLine = e.target.parentElement.dataset.id;
        this._selectAll('disable');
        e.target.focus();
        e.stopPropagation();
    };
    MoxyEditor.prototype._handleKeyDown = function (e) {
        var _this = this;
        if (e.keyCode === 9) {
            var pos = this._getCaretCharOffset(e.target);
            if (pos !== e.target.innerText.length) {
                e.target.innerText =
                    e.target.innerText.substring(0, pos) +
                        '\t'
                        + e.target.innerText.substring(pos);
                this._colorizeLine(e.target, '');
                this._setCurrentCursorPosition(e.target, pos + 1);
            }
            else {
                e.target.innerHTML += '\t';
                this._colorizeLine(e.target, '', pos + 1);
            }
            e.stopPropagation();
            e.preventDefault();
            return;
        }
        if (e.ctrlKey === true && e.keyCode === 65 && this._lines.querySelectorAll('.line').length > 1) {
            this._selectAll('enable');
            this._setSelectionRange(this._lines, 0, this._lines.innerText.length);
            return;
        }
        if (e.keyCode === 37) {
            var pos = this._getCaretCharOffset(e.target);
            if (e.target.innerText.substring(pos - 1).indexOf('\t') !== -1) {
                e.preventDefault();
            }
        }
        if (e.keyCode === 38 && e.target.parentElement.dataset.id > 1) {
            var offset = this._getOffset(e.target, e.target.parentElement.previousSibling);
            this._setActiveLine(e.target.parentElement.previousSibling.dataset.id, offset);
            return;
        }
        if (e.keyCode === 40 && e.target.parentElement.nextSibling) {
            var offset = this._getOffset(e.target, e.target.parentElement.nextSibling);
            this._setActiveLine(e.target.parentElement.nextSibling.dataset.id, offset);
            return;
        }
        if (e.keyCode === 8) {
            var offset = this._getCaretCharOffset(e.target);
            if (offset === 0 && e.target.innerHTML !== '<br>' && e.target.parentElement.dataset.id > 1) {
                var text = e.target.innerText;
                var element_2 = this._removeLine(e.target.parentElement.dataset.id, true);
                element_2.innerText += text;
                setTimeout(function () { return _this._colorizeLine(element_2, ''); }, 1);
                return;
            }
            if (e.target.innerText === '' && e.target.parentElement.dataset.id > 1
                || e.target.innerHTML === '<br>') {
                this._removeLine(e.target.parentElement.dataset.id, true);
                return;
            }
            var sel = window.getSelection();
            if (sel && sel.anchorOffset !== sel.focusOffset) {
                var start = void 0;
                var end = void 0;
                if (sel.anchorOffset < sel.focusOffset) {
                    start = sel.anchorOffset;
                    end = sel.focusOffset;
                }
                else {
                    start = sel.focusOffset;
                    end = sel.anchorOffset;
                }
                if (sel.toString().length > end - start) {
                    var numLines = sel.toString().split('\n').length;
                    var target = e.target.dataset.id;
                    var nextTarget = e.target.previousSibling
                        ? e.target.previousSibling.dataset.id
                        : '';
                    if (nextTarget) {
                        for (var i = 0; i < numLines; i++) {
                            this._removeLine(target);
                            target = nextTarget;
                            nextTarget = this._lines
                                .querySelector('div[data-id="' + target + '"]')
                                .previousSibling.dataset.id;
                        }
                        return;
                    }
                    else {
                        e.target.innerText = '';
                        return;
                    }
                }
            }
        }
    };
    MoxyEditor.prototype._removeLine = function (lineNo, focus) {
        var _this = this;
        if (focus === void 0) { focus = false; }
        if (this._lineNos.querySelector('span:last-child')) {
            this._lineNos.querySelector('span:last-child').remove();
        }
        var elem = this._lines.querySelector('div[data-id="' + lineNo + '"]');
        if (elem) {
            var prevSibling_1 = elem.previousSibling;
            var prev = prevSibling_1.dataset.id;
            elem.remove();
            if (focus) {
                this._setActiveLine(prev);
                setTimeout(function () { return _this._setCaretPositionToEnd(prevSibling_1.querySelector('pre')); }, 1);
            }
            this._lineCount--;
            return prevSibling_1.querySelector('pre');
        }
    };
    MoxyEditor.prototype._setActiveLine = function (lineNo, offset) {
        var _this = this;
        if (this._lines.querySelector("div[data-id=\"" + lineNo + "\"]")) {
            this._lines.querySelector("div[data-id=\"" + lineNo + "\"] pre").click();
            if (offset) {
                setTimeout(function () {
                    return _this._setCurrentCursorPosition(_this._lines.querySelector("div[data-id=\"" + lineNo + "\"] pre"), offset);
                }, 1);
            }
        }
    };
    MoxyEditor.prototype._setCaretPositionToEnd = function (target) {
        target.focus();
        if (typeof window.getSelection !== 'undefined'
            && typeof document.createRange !== 'undefined') {
            var range = document.createRange();
            range.selectNodeContents(target);
            range.collapse(false);
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
        else if (typeof document.body.createTextRange !== 'undefined') {
            var textRange = document.body.createTextRange();
            textRange.moveToElementText(target);
            textRange.collapse(false);
            textRange.select();
        }
    };
    // TODO - backspace isnt being handled properly after hitting return (newline)
    // TODO - moving down is off by an index (adding +1)
    // TODO - add support if you are between lines
    MoxyEditor.prototype._handleKeyPress = function (e) {
        if (e.keyCode === 13) {
            var offset = this._getCaretCharOffset(e.target);
            var content = e.target.innerText.substring(offset);
            var element = this._addLine(true, e.target.parentElement);
            if (offset !== e.target.innerText.length) {
                e.target.innerText = e.target.innerText.substring(0, offset);
                this._colorizeLine(e.target, '');
                element.innerText += content;
                this._colorizeLine(element, '', element.innerText.length + content.length);
            }
            else {
                this._setCaretPositionToEnd(element);
            }
            e.preventDefault();
            return;
        }
        if (e.keyCode >= 32 && e.keyCode <= 127) {
            e.preventDefault();
            var char = String.fromCharCode(e.keyCode);
            // Handles replacing selected text
            if (this._getSelectedText().length > 1) {
                var end = this._getCaretCharOffset(e.target);
                var start = end - this._getSelectedText().length;
                e.target.innerText =
                    e.target.innerText.substring(0, start)
                        + char
                        + e.target.innerText.substring(end);
                this._colorizeLine(e.target, '', end);
            }
            else {
                if (this._options.autoBraces) {
                    return void this._colorizeLine(e.target, ASCII_AUTOCOMPLETE_MAP[e.keyCode]
                        ? char + ASCII_AUTOCOMPLETE_MAP[e.keyCode]
                        : char);
                }
                this._colorizeLine(e.target, char);
            }
        }
    };
    // TODO auto add tabs based on indent level
    MoxyEditor.prototype._colorizeLine = function (target, value, positionChar) {
        var caretPos = this._getCaretCharOffset(target);
        var text = target.innerText.toString().substring(0, caretPos)
            + value
            + target.innerText.toString().substring(caretPos);
        text = text.replace('\n', '');
        text = text.replace(/\</g, '&lt;').replace(/\>/g, '&gt;');
        // colorize return to same as if
        // TODO - add variable syntax
        var classes = [
            // doesnt seem to work
            // {class: 'syntax-varstring', match: /\`\$\{([^\`]*)\}\`/ },
            { "class": 'syntax-tab', match: /\t/ },
            { sp: true, "class": 'syntax-keyword', match: /(let|var|true|false|const|class|interface|private|public) / },
            { sp: true, "class": 'syntax-keyword', match: /(([ \n;\t])?(this)|(^this))/ },
            { "class": 'syntax-html', match: /(&lt;)\/?(html|body|br|ul|li|article|aside|main|div|span|p|i|b|strong|) ?\/?(&gt;)/ },
            { "class": 'syntax-operator', match: /(===|==| = |!==|<=|>=|&&|\|\||&lt;|&gt;)/ },
            { "class": 'syntax-statement', match: /(([ \n;\t])?(if|else|return|break)|(^if|^else|^return|^break))/ },
            { "class": 'syntax-string', match: /'([^']*)'/ },
            { "class": 'syntax-string', match: /\`([^\`]*)\`/ },
            { "class": 'syntax-function', match: /([a-zA-Z0-9]+)((\()([^\)]*)(\)))/ },
            { "class": 'syntax-braces', match: /(\[\]|\[|\]|\(\)|\(|\)|\{\}|\{|\})/ },
            { "class": 'syntax-braces', match: /({|})/ },
            { "class": 'syntax-comment', match: /((\/\*)(.*)(\*\/)|(\/\/)(.*))/ },
            { sp: true, "class": "syntax-type", match: /(?:: ?)([a-zA-Z]*)/g },
        ];
        var nText = text;
        var processMatch = function (text, match, cls) {
            if (match && match[0] && match[0].length) {
                var nText_1 = text;
                var replacement = "<span class=\"" + cls["class"] + "\">" + match[0] + "</span>";
                if (cls.sp) {
                    if (cls["class"] === 'syntax-type') {
                        replacement = ":<span class=\"" + cls["class"] + "\">" + match[0].slice(1) + "</span>";
                    }
                }
                nText_1 = nText_1.substring(0, match.index)
                    + replacement
                    + nText_1.substring(match.index + match[0].length);
                if (cls["class"] === 'syntax-tab') {
                    return [nText_1, replacement.length - 4];
                }
                return [nText_1, replacement.length];
            }
            return [text, 0];
        };
        classes.forEach(function (cls) {
            var match;
            // tslint:disable: no-conditional-assignment
            var r = RegExp(cls.match, 'g');
            var iter = 0;
            while ((match = r.exec(nText)) !== null) {
                //console.log(`Found ${match[0]} at ${match.index}. Next starts at ${r.lastIndex}.`)
                var _a = processMatch(nText, match, cls), txt = _a[0], offset = _a[1];
                nText = txt;
                r.lastIndex += offset;
                iter++;
                if (iter > 100) {
                    break;
                }
            }
        });
        target.innerHTML = nText;
        if (positionChar !== undefined) {
            this._setCurrentCursorPosition(target, positionChar);
        }
        else {
            this._setCurrentCursorPosition(target, caretPos + 1);
        }
    };
    return MoxyEditor;
}());
