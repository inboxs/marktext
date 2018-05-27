import cheerio from 'cheerio'
import selection from '../selection'
import { CLASS_OR_ID, blockContainerElementNames } from '../config'

const copyCutCtrl = ContentState => {
  ContentState.prototype.cutHandler = function () {
    if (this.checkInCodeBlock()) {
      return
    }
    const { start, end } = this.cursor
    const startBlock = this.getBlock(start.key)
    const endBlock = this.getBlock(end.key)
    startBlock.text = startBlock.text.substring(0, start.offset) + endBlock.text.substring(end.offset)
    if (start.key !== end.key) {
      this.removeBlocks(startBlock, endBlock)
    }
    this.cursor = {
      start,
      end: start
    }
    this.partialRender()
  }

  ContentState.prototype.checkInCodeBlock = function () {
    const { start, end } = selection.getCursorRange()
    const block = this.getBlock(start.key)
    if (start.key === end.key && block.type === 'pre') {
      return true
    }
    return false
  }

  ContentState.prototype.copyCutHandler = function (event) {
    if (this.checkInCodeBlock()) {
      return
    }
    event.preventDefault()
    const html = selection.getSelectionHtml()
    // const xx = event.clipboardData.getData('text/plain')
    const $ = cheerio.load(html)
    const children = $('body').contents()
    let text = ''

    children.each((i, child) => {
      const tagName = child.tagName
      const content = $(child).text()
      if (content) {
        text += blockContainerElementNames.indexOf(tagName) > -1 && text ? `\n${content}` : `${content}`
      }
    })

    $(
      `.${CLASS_OR_ID['AG_REMOVE']}, .${CLASS_OR_ID['AG_TOOL_BAR']},
      .${CLASS_OR_ID['AG_MATH_RENDER']}, .${CLASS_OR_ID['AG_HTML_PREVIEW']},
      .${CLASS_OR_ID['AG_MATH_PREVIEW']}, .${CLASS_OR_ID['AG_COPY_REMOVE']}`
    ).remove()
    $(`.${CLASS_OR_ID['AG_EMOJI_MARKER']}`).text(':')
    $(`.${CLASS_OR_ID['AG_NOTEXT_LINK']}`).empty()
    $(`[data-role=hr]`).replaceWith('<hr>')

    const aLink = $(`.${CLASS_OR_ID['AG_A_LINK']}`)
    if (aLink.length > 0) {
      aLink.each((i, a) => {
        const anchor = $(a)
        const html = anchor.html()
        anchor.replaceWith(`<span>${html}</span>`)
      })
    }

    const anchors = $(`a[data-href]`)
    if (anchors.length > 0) {
      anchors.each((i, a) => {
        const anchor = $(a)
        const href = anchor.attr('data-href')
        anchor.removeAttr('data-href')
        anchor.attr('href', href)
      })
    }

    const codefense = $(`pre.${CLASS_OR_ID['AG_CODE_BLOCK']}`)
    if (codefense.length > 0) {
      codefense.each((i, cf) => {
        const ele = $(cf)
        const id = ele.attr('id')
        const language = ele.attr('data-lang') || ''
        const cm = this.codeBlocks.get(id)
        const codeText = cm.getValue()
        ele.empty()
        ele.html(`<code class="language-${language}" lang="${language}">${codeText}</code>`)
      })
    }

    const htmlBlock = $(`figure[data-role='HTML']`)
    if (htmlBlock.length > 0) {
      htmlBlock.each((i, hb) => {
        const ele = $(hb)
        const id = ele.attr('id')
        const { text } = this.getBlock(id)
        const pre = $('<pre></pre>')
        pre.text(text)
        ele.replaceWith(pre)
      })
    }

    const mathBlock = $(`figure.ag-multiple-math-block`)
    if (mathBlock.length > 0) {
      mathBlock.each((i, hb) => {
        const ele = $(hb)
        const id = ele.attr('id')
        const { math } = this.getBlock(id).children[1]
        const pre = $('<pre class="multiple-math"></pre>')
        pre.text(math)
        ele.replaceWith(pre)
      })
    }

    event.clipboardData.setData('text/html', $('body').html())
    event.clipboardData.setData('text/plain', text)
  }
}

export default copyCutCtrl
