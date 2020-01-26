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
        div.innerHTML = ''
        div.className = 'line'
        div.dataset.id = (++this._id).toString()
        div.appendChild(pre)
        this._lineCount++
        div.tabIndex = 0
        this._addLineNo()

        if (insertAfterLine) {
            insertAfterLine.insertAdjacentElement('afterend', div)
        } else {
            this._lines.append(div)
        }

        div.onkeydown = (e) => this._handleKeyDown(e)
        div.onkeypress = (e) => this._handleKeyPress(e)
        div.onclick = (e) => this._handleLineClick(e)
        if (focus === true) {
            div.click()
            div.focus()
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
        this._editor.onblur = () => {
            clearInterval(this._cursor)
            this._editor.querySelector('.blink').classList.remove('blink')
        }
    }
    private _handleLineClick(e: any): void {
        if (!e.target.dataset.id) {
            return
        }
        this._prevLine = this._activeLine

        this._activeLine = e.target.dataset.id
        e.target.focus()
        this._addCursor()
        e.stopPropagation()
    }
    // add shift + selection highlight
    // add cursor position
    private _handleKeyDown(e: any): void {
        if (e.keyCode === 9) {
            e.target.querySelector('pre').innerHTML += '\t'
            e.stopPropagation()
            e.preventDefault()
        }
        if (e.keyCode === 38 && e.target.dataset.id > 1) {
            this._setActiveLine(e.target.previousSibling.dataset.id)
            return
        }
        if (e.keyCode === 40 && e.target.nextSibling) {
            this._setActiveLine(e.target.nextSibling.dataset.id)
            return
        }

        if (e.keyCode === 37) {
            if (Number(this._lines.querySelector(`.cursor`).style.left) > 0) {
                this._lines.querySelector(`.cursor`).style.left -= 7
            }
        }

        if (e.keyCode === 39) {
            this._lines.querySelector(`.cursor`).style.left += 7
        }

        if (e.keyCode === 8) {
            if (e.target.querySelector('pre').innerText === '' && e.target.dataset.id > 1) {
                this._removeLine(e.target.dataset.id, true)
                return
            }
            const sel = window.getSelection()
            if (sel && sel.anchorOffset !== sel.focusOffset) {
                e.target.querySelector('pre').innerText =
                    e.target.querySelector('pre').innerText.slice(0, sel.anchorOffset)
                    + e.target.querySelector('pre').innerText.slice(sel.anchorOffset + sel.focusOffset)
            }

            e.target.querySelector('pre').innerText =
                e.target.querySelector('pre').innerText.slice(0, e.target.querySelector('pre').innerText.length - 1)

            this._tasteTheRainbow(e.target)
        }
    }

    private _removeLine(lineNo: string, focus: boolean): void {
        this._lineNos.querySelector('span:last-child').remove()
        const prev: string = this._lines.querySelector('div[data-id="' + lineNo + '"]').previousSibling.dataset.id
        this._lines.querySelector('div[data-id="' + lineNo + '"]').remove()
        this._setActiveLine(prev)
        this._lineCount--
    }
    private _setActiveLine(lineNo: string): void {
        if (this._lines.querySelector(`div[data-id="${lineNo}"]`)) {
            this._lines.querySelector(`div[data-id="${lineNo}"]`).click()
        }
    }
    private _handleKeyPress(e: any): void {
        if (e.keyCode === 13) {
            this._addLine(true, e.target)
            return
        }
        e.target.querySelector('pre').innerText += String.fromCharCode(e.keyCode)
        this._tasteTheRainbow(e.target)
    }
    private _tasteTheRainbow(target: any): void {
        const text = target.querySelector('pre').innerText.toString()
        console.log(text)
        // colorize return to same as if
        const classes = [
            {sp: true, class: 'syntax-keyword', match: /(([ \n;\t])(let|class|interface|private|public)|(^let|^class|^interface|^private|^public)) / },
            {sp: true, class: 'syntax-keyword', match: /(([ \n;\t])(this)|(^this))/ },
            {class: 'syntax-statement', match: /(([ \n;\t])(if|else|return)|(^if|else|return))/ },
            {class: 'syntax-string', match: /'([^']*)'/},
            {class: 'syntax-function', match: /([a-zA-Z0-9]+)((\()([^\)]*)(\)))/},
            {class: 'syntax-braces', match: /(\[\]|\[|\]|\(\)|\(|\)|\{\}|\{|\})/},
            {class: 'syntax-comment', match: /((\/\*)(.*)(\*\/)|(\/\/)(.*))/},
            {sp: true, class: `syntax-type`, match: /(?:: ?)([a-zA-Z]*)/g},
        ]

        const classesExtended = [
            {class: 'syntax-function', match: /([a-zA-Z0-9]*)(?:(\()(.*)(\)))/g},
        ]
        let nText = text
        let iter: number = 0

        // nText = nText.replace(/([^\>])(class)([^\<])/g, '<span class="syntax-keyword">class</span>')

        const processMatch = (text: string, match: any, cls: any): any => {
            if (match && match[0] && match[0].length) {
                let nText: string = text
                console.log(match)
                let replacement: string = `<span class="${cls.class}">${match[0]}</span>`
                if (cls.sp) {
                    if (cls.class === 'syntax-type') {
                        replacement = `:<span class="${cls.class}">${match[0].slice(1)}</span>`
                    }
                    if (cls.class === 'syntax-keyword') {
                        console.log('MATCH', match)
                    }
                }
                nText = nText.substring(0, match.index)
                    + replacement
                    + nText.substring(match.index + match[0].length)
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
        target.querySelector('pre').innerHTML = nText
    }
    private _addCursor(): void {
        if (this._lines.querySelector('.cursor')) {
            this._lines.querySelector('.cursor').remove()
        }
        const cursor = document.createElement('div')
        cursor.className = 'cursor'
        console.log(this._activeLine)
        this._lines.querySelector(`div[data-id="${this._activeLine}"]`).append(cursor)
        if (this._cursor) {
            clearInterval(this._cursor)
            if ( this._lines.querySelector(`.blink`)) {
                this._lines.querySelector(`.blink`).classList.remove('blink')
            }
        }
        this._cursor = setInterval(() => {
            if (!this._lines.querySelector(`div[data-id="${this._activeLine}"]`)) {
                clearTimeout(this._cursor)
                return
            }
            const classList = Array.from(this._lines.querySelector(`.cursor`).classList)
            // tslint:disable-next-line: no-bitwise
            if (classList && ~classList.indexOf('blink')) {
                this._lines.querySelector(`.cursor`).classList.remove('blink')
            } else {
                this._lines.querySelector(`.cursor`).classList.add('blink')
            }
        }, 600)
    }
}
