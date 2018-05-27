const LIST_REG = /ul|ol/

const pasteCtrl = ContentState => {
  // check paste type: `MERGE` or `NEWLINE`
  ContentState.prototype.checkPasteType = function (start, fragment) {
    const fragmentType = fragment.type
    if (start.type === 'span') {
      start = this.getParent(start)
    }
    if (fragmentType === 'p') return 'MERGE'
    if (fragmentType === 'blockquote') return 'NEWLINE'
    let parent = this.getParent(start)
    if (parent && parent.type === 'li') parent = this.getParent(parent)
    let startType = start.type
    if (start.type === 'p') {
      startType = parent ? parent.type : startType
    }
    if (LIST_REG.test(fragmentType) && LIST_REG.test(startType)) {
      return 'MERGE'
    } else {
      return startType === fragmentType ? 'MERGE' : 'NEWLINE'
    }
  }

  ContentState.prototype.pasteHandler = function (event) {
    if (this.checkInCodeBlock()) {
      return
    }
    event.preventDefault()
    const text = event.clipboardData.getData('text/plain')
    let html = event.clipboardData.getData('text/html')

    if (!html) {
      html = text.split(/\n+/)
        .filter(t => t)
        .map(t => `<p class="plain-text">${t}</p>`)
        .join('')
    }

    const stateFragments = this.html2State(html)
    if (stateFragments.length <= 0) return
    // step 1: if select content, cut the content, and chop the block text into two part by the cursor.
    const { start, end } = this.cursor
    const startBlock = this.getBlock(start.key)
    const endBlock = this.getBlock(end.key)
    const parent = this.getParent(startBlock)
    const cacheText = endBlock.text.substring(end.offset)
    startBlock.text = startBlock.text.substring(0, start.offset)
    if (start.key !== end.key) {
      this.cutHandler()
    }
    // step 2: when insert the fragments, check begin a new block, or insert into pre block.
    const firstFragment = stateFragments[0]
    const tailFragments = stateFragments.slice(1)
    const pasteType = this.checkPasteType(startBlock, firstFragment)
    const getLastBlock = blocks => {
      const len = blocks.length
      const lastBlock = blocks[len - 1]

      if (lastBlock.children.length === 0) {
        return lastBlock
      } else {
        return getLastBlock(lastBlock.children)
      }
    }
    const lastBlock = getLastBlock(stateFragments)
    let key = lastBlock.key
    let offset = lastBlock.text.length
    lastBlock.text += cacheText

    switch (pasteType) {
      case 'MERGE':
        if (LIST_REG.test(firstFragment.type)) {
          const listItems = firstFragment.children
          const firstListItem = listItems[0]
          const liChildren = firstListItem.children
          const originListItem = this.getParent(parent)
          const originList = this.getParent(originListItem)
          if (liChildren[0].type === 'p') {
            // TODO @JOCS
            startBlock.text += liChildren[0].children[0].text
            liChildren[0].children.slice(1).forEach(c => this.appendChild(parent, c))
            const tail = liChildren.slice(1)
            if (tail.length) {
              tail.forEach(t => {
                this.appendChild(originListItem, t)
              })
            }
            const firstFragmentTail = listItems.slice(1)
            if (firstFragmentTail.length) {
              firstFragmentTail.forEach(t => {
                this.appendChild(originList, t)
              })
            }
          } else {
            listItems.forEach(c => {
              this.appendChild(originList, c)
            })
          }
          let target = originList
          tailFragments.forEach(block => {
            this.insertAfter(block, target)
            target = block
          })
        } else {
          if (firstFragment.type === 'p') {
            startBlock.text += firstFragment.children[0].text
            firstFragment.children.slice(1).forEach(line => this.appendChild(parent, line))
          } else {
            startBlock.text += firstFragment.text
          }

          let target = parent
          tailFragments.forEach(block => {
            this.insertAfter(block, target)
            target = block
          })
        }
        break

      case 'NEWLINE':
        let target = startBlock.type === 'span' ? parent : startBlock
        stateFragments.forEach(block => {
          this.insertAfter(block, target)
          target = block
        })
        if (startBlock.text.length === 0) this.removeBlock(startBlock)
        if (this.isOnlyChild(startBlock)) this.removeBlock(parent)
        break
      default:
        throw new Error('unknown paste type')
    }
    // step 3: set cursor and render
    let cursorBlock = this.getBlock(key)
    if (!cursorBlock) {
      key = startBlock.key
      offset = startBlock.text.length - cacheText.length
      cursorBlock = startBlock
    }
    // TODO @Jocs duplicate with codes in updateCtrl.js
    if (cursorBlock && cursorBlock.type === 'span' && cursorBlock.functionType === 'multiplemath') {
      this.updateMathContent(cursorBlock)
    }
    this.cursor = {
      start: {
        key, offset
      },
      end: {
        key, offset
      }
    }
    this.partialRender()
  }
}

export default pasteCtrl
