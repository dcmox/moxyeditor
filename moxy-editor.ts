const REGEX_HTML_CHARS = /[&<>"']/g
const HTML_CHAR_MAP: any = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    '\'': '&#039;',
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
    private _cursor: any
    private _prevLine: number
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

    private _addLine(focus: boolean = false, insertAfterLine?: HTMLElement): void {
        const div: HTMLElement = document.createElement('div')
        const pre: HTMLElement = document.createElement('pre')
        pre.contentEditable = 'true'
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
    }
    private _addLineNo(): void {
        const span: HTMLElement = document.createElement('span')
        span.dataset.lineNo = this._lineCount.toString()
        span.innerHTML = this._lineCount.toString()
        this._lineNos.append(span)
    }
    private _addEvents(): void {
        this._editor.onclick = () => {
            this._setActiveLine(this._lines.querySelector('div.line:last-child').dataset.id)
        }
    }
    private _handleLineClickFromPre(e: any): void {
        console.log(e.target.parentElement)
        if (!e.target.parentElement.dataset.id) {
            return
        }
        this._prevLine = this._activeLine

        this._activeLine = e.target.parentElement.dataset.id

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

        return caretOffset;
    }

    private _handleKeyDown(e: any): void {
        if (e.keyCode === 9) {
            console.log(e.target.innerHTML)
            e.target.innerHTML += '\t'
            e.stopPropagation()
            e.preventDefault()
            this._tasteTheRainbow(e.target, '')
            return
        }

        if (e.keyCode === 38 && e.target.parentElement.dataset.id > 1) {
            this._setActiveLine(e.target.parentElement.previousSibling.dataset.id)
            return
        }
        if (e.keyCode === 40 && e.target.parentElement.nextSibling) {
            this._setActiveLine(e.target.parentElement.nextSibling.dataset.id)
            return
        }

        if (e.keyCode === 8) {
            if (e.target.innerText === '' && e.target.parentElement.dataset.id > 1) {
                this._removeLine(e.target.parentElement.dataset.id, true)
                return
            }
            const sel = window.getSelection()
            //const pos = this._getCaretCharOffset(e.target)

            if (sel && sel.anchorOffset !== sel.focusOffset) {
                let start: number
                let end: number
                if ( sel.anchorOffset < sel.focusOffset) {
                    start = sel.anchorOffset
                    end =  sel.focusOffset
                } else {
                    start = sel.focusOffset
                    end =  sel.anchorOffset
                }
                if (sel.toString().length > end - start) {
                    console.log('multi line delete!')
                    const numLines: number = sel.toString().split('\n').length
                    console.log('num lines', numLines)
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
 
            this._tasteTheRainbow(e.target, '')
        }
    }

    private _removeLine(lineNo: string, focus: boolean = false): void {
        this._lineNos.querySelector('span:last-child').remove()
        const prevSibling = this._lines.querySelector('div[data-id="' + lineNo + '"]').previousSibling
        const prev: string = prevSibling.dataset.id
        this._lines.querySelector('div[data-id="' + lineNo + '"]').remove()
        this._setActiveLine(prev)
        setTimeout( () => this._setCaretPosition(prevSibling.querySelector('pre')), 1)
        this._lineCount--
    }
    private _setActiveLine(lineNo: string): void {
        if (this._lines.querySelector(`div[data-id="${lineNo}"]`)) {
            this._lines.querySelector(`div[data-id="${lineNo}"] pre`).click()
        }
    }
    private _setCaretPosition(target: any): void {
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

    private _handleKeyPress(e: any): void {
        if (e.keyCode === 13) {
            this._addLine(true, e.target.parentElement)
            e.preventDefault()
            return
        }
        if (e.keyCode >= 32 && e.keyCode <= 127) {
            e.preventDefault()
            this._tasteTheRainbow(e.target, String.fromCharCode(e.keyCode))
        }
    }
    // todo get inserting at spot to work correctly
    // auto add tabs based on indent level
    private _tasteTheRainbow(target: any, value: string): void {
        let text = target.innerText.toString() + value
        text = text.replace('\n', '')
        // colorize return to same as if
        const classes = [
            {class: 'syntax-tab', match: /\t/},
            {sp: true, class: 'syntax-keyword', match: /(([ \n;\t])(let|class|interface|private|public)|(^let|^class|^interface|^private|^public)) / },
            {sp: true, class: 'syntax-keyword', match: /(([ \n;\t])?(this)|(^this))/ },
            {class: 'syntax-statement', match: /(([ \n;\t])?(if|else|return)|(^if|^else|^return))/ },
            {class: 'syntax-string', match: /'([^']*)'/},
            {class: 'syntax-function', match: /([a-zA-Z0-9]+)((\()([^\)]*)(\)))/},
            {class: 'syntax-braces', match: /(\[\]|\[|\]|\(\)|\(|\)|\{\}|\{|\})/},
            {class: 'syntax-braces', match: /({|})/},
            {class: 'syntax-comment', match: /((\/\*)(.*)(\*\/)|(\/\/)(.*))/},
            {sp: true, class: `syntax-type`, match: /(?:: ?)([a-zA-Z]*)/g},
        ]

        let nText = text

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
                    return [ nText, replacement.length - 4]
                }
                return [ nText, replacement.length ]
            }
            return [ text, 0]
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
        this._setCaretPosition(target)
    }
}
