const REGEX_HTML_CHARS = /[&<>"']/g
const HTML_CHAR_MAP: any = {
    '"': '&quot;',
    '&': '&amp;',
    '\'': '&#039;',
    '<': '&lt;',
    '>': '&gt;',
    '`': '&#x60;',
}
const escapeChars = (s: string) => s.replace(/[^a-zA-Z0-9]/g, (m: string) => '\\' + m)
const notMatched = (match: string) => new RegExp('([^\>])(' + escapeChars(match) + ')([^\<])', 'g')
const decodeHTML = (html: string) => html.replace(REGEX_HTML_CHARS, (m: string) => HTML_CHAR_MAP[m])
class MoxyEditor {
    private _editor: HTMLElement
    private _lines: any
    private _lineNos: HTMLElement
    private _id: number = 0
    private _lineCount: number = 0
    private _activeLine: number
    private _prevLine: number
    private _editorAction: string

    constructor(editorId: string) {
        this._editor = document.querySelector(`#${editorId}`)
        this._init()
        this._lines = this._editor.querySelector('.lines')
        this._lineNos = this._editor.querySelector('.lineNo')
        this._setup()
    }

    private _init(): void {
        this._editor.classList.add('moxyEditor')

        const lineNo = document.createElement('div')
        lineNo.classList.add('lineNo')

        const lines = document.createElement('div')
        lines.classList.add('lines')

        this._editor.appendChild(lineNo)
        this._editor.appendChild(lines)
    }

    private _setup(): void {
        this._addLine()
        this._addEvents()
    }
    private _handlePaste(e: any, element: any): void {
        // Stop data actually being pasted into div
        e.stopPropagation()
        e.preventDefault()

        // Get pasted data via clipboard API
        const clipboardData = e.clipboardData || window.clipboardData
        const pastedData = clipboardData.getData('text')

        // Clean our data
        const div: HTMLElement = document.createElement('div')
        div.innerHTML = pastedData
        const lines: string[] = div.innerText.split('\n')
        element.innerHTML = this._spacesToTab(lines[0])

        // Add lines
        this._tasteTheRainbow(element, '')
        for (let i = 1; i < lines.length; i++) {
            const element = this._addLine()
            element.innerHTML = this._spacesToTab(lines[i])
            this._tasteTheRainbow(element, '')
        }
    }

    private _spacesToTab = (str: string) => str.replace(/    /g, '\t')

    private _addLine(focus: boolean = false, insertAfterLine?: HTMLElement): any {
        const div: HTMLElement = document.createElement('div')
        const pre: HTMLElement = document.createElement('pre')
        pre.contentEditable = 'true'
        pre.spellcheck = false
        pre.onpaste = (e) => this._handlePaste(e, pre)
        div.innerHTML = ''
        div.className = 'line'
        div.dataset.id = (++this._id).toString()
        let tabCount: number = 0
        if (insertAfterLine && insertAfterLine.innerHTML.indexOf('\t') > -1) {
            tabCount = insertAfterLine.innerHTML.split('\t').length
            pre.innerHTML = new Array(tabCount - 1).fill('\t').join('')
        }
        div.appendChild(pre)
        this._lineCount++
        div.tabIndex = 0
        this._addLineNo()

        if (insertAfterLine) {
            insertAfterLine.insertAdjacentElement('afterend', div)
        } else {
            this._lines.append(div)
        }

        pre.onkeypress = (e) => this._handleKeyPress(e)
        pre.onkeydown = (e) => this._handleKeyDown(e)
        pre.onclick = (e) => this._handleLineClickFromPre(e)

        if (focus === true) {
            pre.click()
            pre.focus()
            if (tabCount) {
                this._tasteTheRainbow(pre, '')
            }
        }

        return pre
    }
    private _addLineNo(): void {
        const span: HTMLElement = document.createElement('span')
        span.dataset.lineNo = this._lineCount.toString()
        span.innerHTML = this._lineCount.toString()
        this._lineNos.append(span)
    }
    private _addEvents(): void {
        this._editor.onclick = () => {
            const offset = this._getOffset(null, this._lines.querySelector('div.line:last-child'))
            this._setActiveLine(this._lines.querySelector('div.line:last-child').dataset.id, offset)
            this._selectAll('disable')
        }
        this._editor.oncut = (e) => {
            this._editorAction = 'cut'
            document.execCommand('copy')
        }
        window.onkeyup = (e) => {
            if(e.which === 8 && !this._isEditable()) {
                this._clearEditor()
                this._selectAll('disable')
                this._setActiveLine('1')
            }
        }
        this._editor.oncopy = (e) => {
            if (this._editorAction === 'cut') {
                let text
                if (window.getSelection) {
                    text = window.getSelection().toString()
                } else if (document.selection && document.selection.type !== 'Control') {
                    text = document.selection.createRange().text
                }
                e.clipboardData.setData('text', text)
                this._editorAction = ''
                this._clearEditor()
                e.preventDefault()
            }
        }
    }
    private _clearEditor(): void {
        const lines = this._lines.querySelectorAll('.line')
        for (let i = lines.length - 1; i > 0; i--) {
            this._removeLine(lines[i].dataset.id, false)
        }
        lines[0].querySelector('pre').innerText = ''
    }
    private _handleLineClickFromPre(e: any): void {
        if (!e.target.parentElement.dataset.id) { return }

        this._prevLine = this._activeLine
        this._activeLine = e.target.parentElement.dataset.id
        this._selectAll('disable')
        e.target.focus()
        e.stopPropagation()
    }

    private _getCaretCharOffset = (element: any) => {
        let caretOffset = 0

        if (window.getSelection) {
            const range = window.getSelection().getRangeAt(0)
            const preCaretRange = range.cloneRange()
            preCaretRange.selectNodeContents(element)
            preCaretRange.setEnd(range.endContainer, range.endOffset)
            caretOffset = preCaretRange.toString().length
        } else if (document.selection && document.selection.type !== 'Control') {
            const textRange = document.selection.createRange()
            const preCaretTextRange = document.body.createTextRange()
            preCaretTextRange.moveToElementText(element)
            preCaretTextRange.setEndPoint('EndToEnd', textRange)
            caretOffset = preCaretTextRange.text.length
        }

        return caretOffset
    }
    // Get offset of a line with tab consideration
    private _getOffset = (currentLine: any, previousLine: any) => {
        let offset: number = currentLine ? this._getCaretCharOffset(currentLine) : 0
        while ( true ) {
            if (previousLine.innerText.substring(offset) !== '\t') {
                break
            }
            offset++
        }
        return offset
    }

    // Courtesy of https://jsfiddle.net/8mdX4/1211/
    private _getTextNodesIn = (node: any) => {
        const textNodes = []
        if (node.nodeType === 3) {
            textNodes.push(node)
        } else {
            const children = node.childNodes
            for (let i = 0, len = children.length; i < len; ++i) {
                textNodes.push.apply(textNodes, this._getTextNodesIn(children[i]))
            }
        }
        return textNodes
    }

    private _setSelectionRange = (el: any, start: number, end: number) => {
        if (document.createRange && window.getSelection) {
            console.log('look')
            const range = document.createRange()
            range.selectNodeContents(el)
            const textNodes = this._getTextNodesIn(el)
            let foundStart = false
            let charCount = 0
            let endCharCount
            let foundEnd = false
            // tslint:disable-next-line: no-conditional-assignment
            for (let i = 0, textNode; textNode = textNodes[i++]; ) {
                endCharCount = charCount + textNode.length
                if (!foundStart && start >= charCount
                        && (start < endCharCount ||
                        (start === endCharCount && i <= textNodes.length))) {
                    range.setStart(textNode, start - charCount)
                    foundStart = true
                }
                if (foundStart && end <= endCharCount) {
                    foundEnd = true
                    range.setEnd(textNode, end - charCount)
                    break
                }
                charCount = endCharCount
            }
            if (!foundEnd) {
                range.setEnd(textNodes[textNodes.length - 1], textNodes[textNodes.length - 1].textContent.length)
            }
            const sel = window.getSelection()
            sel.removeAllRanges()
            sel.addRange(range)
        } else if (document.selection && document.body.createTextRange) {
            const textRange = document.body.createTextRange()
            textRange.moveToElementText(el)
            textRange.collapse(true)
            textRange.moveEnd('character', end)
            textRange.moveStart('character', start)
            textRange.select()
        }
    }

    private _isEditable = (): boolean => this._lines.querySelector('.line pre').contentEditable === 'true'

    private _selectAll = (flag: string = 'enable') => {
        if (flag === 'enable') {
            this._lines.querySelectorAll('.line pre').forEach((line) => line.contentEditable = 'false')
            this._editor.focus()
        } else {
            if (!this._isEditable()) {
                this._lines.querySelectorAll('.line pre').forEach((line) => line.contentEditable = 'true')
            }
        }
    }

    private _handleKeyDown(e: any): void {
        if (e.keyCode === 9) {
            const pos = this._getCaretCharOffset(e.target)
            if (pos !== e.target.innerText.length) {
                e.target.innerText =
                    e.target.innerText.substring(0, pos) +
                    '\t'
                    + e.target.innerText.substring(pos)
                this._tasteTheRainbow(e.target, '')
                this._setCurrentCursorPosition(e.target, pos + 1)
            } else {
                e.target.innerHTML += '\t'
                this._tasteTheRainbow(e.target, '', pos + 1)
            }
            e.stopPropagation()
            e.preventDefault()
            return
        }

        if (e.ctrlKey === true && e.keyCode === 65 && this._lines.querySelectorAll('.line').length > 1) {
            this._selectAll('enable')
            this._setSelectionRange(this._lines, 0, this._lines.innerText.length)
            return
        }

        if (e.keyCode === 37) {
            const pos = this._getCaretCharOffset(e.target)
            if (e.target.innerText.substring(pos - 1).indexOf('\t') !== -1) {
                e.preventDefault()
            }
        }

        if (e.keyCode === 38 && e.target.parentElement.dataset.id > 1) {
            const offset = this._getOffset(e.target, e.target.parentElement.previousSibling)
            this._setActiveLine(e.target.parentElement.previousSibling.dataset.id, offset)
            return
        }
        if (e.keyCode === 40 && e.target.parentElement.nextSibling) {
            const offset = this._getOffset(e.target, e.target.parentElement.nextSibling)
            this._setActiveLine(e.target.parentElement.nextSibling.dataset.id, offset)
            return
        }

        if (e.keyCode === 8) {
            const offset = this._getCaretCharOffset(e.target)
            if (offset === 0 && e.target.innerHTML !== '<br>' && e.target.parentElement.dataset.id > 1) {
                const text = e.target.innerText
                const element = this._removeLine(e.target.parentElement.dataset.id, true)
                element.innerText += text
                setTimeout(() => this._tasteTheRainbow(element, ''), 1)
                return
            }
            if (e.target.innerText === '' && e.target.parentElement.dataset.id > 1
                || e.target.innerHTML === '<br>') {
                this._removeLine(e.target.parentElement.dataset.id, true)
                return
            }
            const sel = window.getSelection()

            if (sel && sel.anchorOffset !== sel.focusOffset) {
                let start: number
                let end: number
                if (sel.anchorOffset < sel.focusOffset) {
                    start = sel.anchorOffset
                    end =  sel.focusOffset
                } else {
                    start = sel.focusOffset
                    end =  sel.anchorOffset
                }

                if (sel.toString().length > end - start) {
                    const numLines: number = sel.toString().split('\n').length
                    let target: string = e.target.dataset.id
                    let nextTarget: string = e.target.previousSibling
                        ? e.target.previousSibling.dataset.id
                        : ''
                    if (nextTarget) {
                        for (let i = 0; i < numLines; i++) {
                            this._removeLine(target)
                            target = nextTarget
                            nextTarget = this._lines
                                .querySelector('div[data-id="' + target + '"]')
                                .previousSibling.dataset.id
                        }
                        return
                    } else {
                        e.target.innerText = ''
                        return
                    }
                }
            }
        }
    }

    private _removeLine(lineNo: string, focus: boolean = false): any {
        if (this._lineNos.querySelector('span:last-child')) {
            this._lineNos.querySelector('span:last-child').remove()
        }
        const elem = this._lines.querySelector('div[data-id="' + lineNo + '"]')
        if (elem) {
            const prevSibling = elem.previousSibling
            const prev: string = prevSibling.dataset.id
            elem.remove()
            if (focus) {
                this._setActiveLine(prev)
                setTimeout(() => this._setCaretPositionToEnd(prevSibling.querySelector('pre')), 1)
            }
            this._lineCount--
            return prevSibling.querySelector('pre')
        }
    }

    private _setActiveLine(lineNo: string, offset?: number): void {
        if (this._lines.querySelector(`div[data-id="${lineNo}"]`)) {
            this._lines.querySelector(`div[data-id="${lineNo}"] pre`).click()
            if (offset) {
                setTimeout(() =>
                    this._setCurrentCursorPosition(this._lines.querySelector(`div[data-id="${lineNo}"] pre`), offset)
                , 1)
            }
        }
    }

    private _setCaretPositionToEnd(target: any): void {
        target.focus()
        if (typeof window.getSelection !== 'undefined'
                && typeof document.createRange !== 'undefined') {
            const range = document.createRange()
            range.selectNodeContents(target)
            range.collapse(false)
            const sel = window.getSelection()
            sel.removeAllRanges()
            sel.addRange(range)
        } else if (typeof document.body.createTextRange !== 'undefined') {
            const textRange = document.body.createTextRange()
            textRange.moveToElementText(target)
            textRange.collapse(false)
            textRange.select()
        }
    }

    // TODO - insert tab before text
    // TODO - select all
    private _handleKeyPress(e: any): void {
        if (e.keyCode === 13) {
            const offset = this._getCaretCharOffset(e.target)
            const content = e.target.innerText.substring(offset)
            const element = this._addLine(true, e.target.parentElement)
            if (offset !== e.target.innerText.length) {
                e.target.innerText = e.target.innerText.substring(0, offset)
                this._tasteTheRainbow(e.target, '')
                element.innerText += content
                this._tasteTheRainbow(element, '', element.innerText.length + content.length)
            } else {
                this._setCaretPositionToEnd(element)
            }
            e.preventDefault()
            return
        }
        if (e.keyCode >= 32 && e.keyCode <= 127) {
            e.preventDefault()
            this._tasteTheRainbow(e.target, String.fromCharCode(e.keyCode))
        }
    }

    // Courtesy of https://jsfiddle.net/nrx9yvw9/5/
    private _createRange = (node: any, chars: any, range?: any) => {
        if (!range) {
            range = document.createRange()
            range.selectNode(node)
            range.setStart(node, 0)
        }

        if (chars.count === 0) {
            range.setEnd(node, chars.count)
        } else if (node && chars.count > 0) {
            if (node.nodeType === Node.TEXT_NODE) {
                if (node.textContent.length < chars.count) {
                    chars.count -= node.textContent.length
                } else {
                     range.setEnd(node, chars.count)
                     chars.count = 0
                }
            } else {
                // tslint:disable-next-line: prefer-for-of
                for (let lp = 0; lp < node.childNodes.length; lp++) {
                    range = this._createRange(node.childNodes[lp], chars, range)
                    if (chars.count === 0) {
                       break
                    }
                }
            }
        }
        return range
    }

    private _setCurrentCursorPosition = (element: any, chars: number) => {
        if (chars >= 0) {
            const selection = window.getSelection()
            const range = this._createRange(element.parentNode, { count: chars })
            if (range) {
                range.collapse(false)
                selection.removeAllRanges()
                selection.addRange(range)
            }
        }
    }

    // TODO auto add tabs based on indent level
    private _tasteTheRainbow(target: any, value: string, positionChar?: number): void {
        const caretPos = this._getCaretCharOffset(target)
        let text: string =
            target.innerText.toString().substring(0, caretPos)
            + value
            + target.innerText.toString().substring(caretPos)

        text = text.replace('\n', '')
        // colorize return to same as if

        // TODO - add variable syntax
        const classes = [
            // doesnt seem to work
            // {class: 'syntax-varstring', match: /\`\$\{([^\`]*)\}\`/ },
            {class: 'syntax-tab', match: /\t/},
            {sp: true, class: 'syntax-keyword', match: /(let|var|true|false|const|class|interface|private|public) / },
            {sp: true, class: 'syntax-keyword', match: /(([ \n;\t])?(this)|(^this))/ },
            {class: 'syntax-operator', match: /(===|==| = |!==|<=|>=|&&|\|\||&lt;|&gt;)/ },
            {class: 'syntax-statement', match: /(([ \n;\t])?(if|else|return|break)|(^if|^else|^return|^break))/ },
            {class: 'syntax-string', match: /'([^']*)'/},
            {class: 'syntax-string', match: /\`([^\`]*)\`/},
            {class: 'syntax-function', match: /([a-zA-Z0-9]+)((\()([^\)]*)(\)))/},
            {class: 'syntax-braces', match: /(\[\]|\[|\]|\(\)|\(|\)|\{\}|\{|\})/},
            {class: 'syntax-braces', match: /({|})/},
            {class: 'syntax-comment', match: /((\/\*)(.*)(\*\/)|(\/\/)(.*))/},
            {sp: true, class: `syntax-type`, match: /(?:: ?)([a-zA-Z]*)/g},
        ]

        let nText: string = text

        const processMatch = (text: string, match: any, cls: any): any => {
            if (match && match[0] && match[0].length) {
                let nText: string = text
                let replacement: string = `<span class="${cls.class}">${match[0]}</span>`
                if (cls.sp) {
                    if (cls.class === 'syntax-type') {
                        replacement = `:<span class="${cls.class}">${match[0].slice(1)}</span>`
                    }
                }

                nText = nText.substring(0, match.index)
                    + replacement
                    + nText.substring(match.index + match[0].length)
                if (cls.class === 'syntax-tab') {
                    return [ nText, replacement.length - 4 ]
                }
                return [ nText, replacement.length ]
            }
            return [ text, 0 ]
        }

        classes.forEach((cls) => {
            let match: any
            // tslint:disable: no-conditional-assignment
            const r: RegExp = RegExp(cls.match, 'g')

            let iter: number = 0
            while ((match = r.exec(nText)) !== null) {
                console.log(`Found ${match[0]} at ${match.index}. Next starts at ${r.lastIndex}.`)
                const [txt, offset] = processMatch(nText, match, cls)
                nText = txt
                r.lastIndex += offset
                iter++
                if (iter > 100) {
                    break
                }
            }
        })
        target.innerHTML = nText
        if (positionChar !== undefined) {
            this._setCurrentCursorPosition(target, positionChar)
        } else {
            this._setCurrentCursorPosition(target, caretPos + 1)
        }
    }
}
