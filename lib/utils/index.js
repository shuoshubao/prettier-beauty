const fs = require('fs')
const prettier = require('prettier')
const htmlparser = require('htmlparser2')

// 默认选项
const prettierOptions = {
    parser: 'babylon', // 'babylon' | 'flow' | 'json' | 'typescript' | 'css' | 'json' | 'graphql' | 'markdown'
    useTabs: false,
    tabWidth: 4,
    printWidth: 1000,
    semi: true, // 分号
    singleQuote: true, // 单引号
    trailingComma: 'none', // 尾逗号
    bracketSpacing: false, // true => { foo: bar }, false => {foo: bar}
    jsxBracketSameLine: false, // 将 > 放在同一行
    insertPragma: false, // 在顶部插入注释 /** @format */
    arrowParens: 'always' // 'avoid': x => x; 'always': (x) => x
}

const prettierLangs = {
    js: 'babylon',
    jsx: 'babylon',
    vue: 'vue',
    css: 'css',
    scss: 'css',
    less: 'css',
    json: 'json',
    md: 'markdown',
    graphql: 'graphql',
    ts: 'typescript'
}

const prettierFormat = (str = '', option = {}) => prettier.format(str, {
    ...prettierOptions,
    ...option,
    singleQuote: option.parser !== 'css'
})

// 单标签
const singleTags = ['area', 'base', 'basefont', 'br', 'col', 'command', 'embed', 'frame', 'hr', 'img', 'input', 'isindex', 'keygen', 'link', 'meta', 'param', 'source', 'track', 'wbr']

// 布尔属性
const booleanAttributes = ['allowfullscreen', 'async', 'autofocus', 'autoplay', 'checked', 'controls', 'default', 'defer', 'disabled', 'hidden', 'ismap', 'loop', 'multiple', 'muted', 'open', 'readonly', 'required', 'reversed', 'scoped', 'seamless', 'selected', 'typemustmatch']

// json 筛选
const only = (data = {}, keys = []) => keys.filter(v => Object.keys(data).includes(v)).reduce((prev, cur) => {
  prev[cur] = data[cur]
  return prev
}, {})

// json 忽略
const omit = (data = {}, keys = []) => Object.keys(data).filter(v => !keys.includes(v)).reduce((prev, cur) => {
    prev[cur] = data[cur]
    return prev
}, {})

// 删除 parent, prev, next
const removeCircular = dom => {
    (Array.isArray(dom) ? dom : [dom]).forEach(v => {
        delete v.parent
        delete v.prev
        delete v.next
        if(v.children && v.children.length) {
            removeCircular(v.children)
        }
    })
}

const attribsToText = attribs => Object.entries(attribs).map(([k, v]) => {
    // console.log(k, v)
    let tempV = v
    if(v === '') {
        return k
    }
    if(k.startsWith('v-') || k.startsWith(':')) {
        // json放前面 因为会把单引号转成双引号
        /*try{
            tempV = prettierFormat(v, {parser: 'json'})
        }catch(e) {}*/
        try{
            tempV = prettierFormat(v, {parser: 'babylon', semi: false})
            if(tempV.startsWith(';')) {
                tempV = tempV.replace(';', '')
            }
        }catch(e) {}
    }else {
        if(v.includes(':')) {
            try{
                tempV = prettierFormat(v, {parser: 'css'})
            }catch(e) {}
        }
    }

    tempV = tempV.split('\n').map(v => v.trim()).filter(v => v).join('')

    return `${k}="${tempV}"`
}).join(' ')

const attribsToPlainText = attribs => Object.entries(attribs).map(([k, v]) => {
    const tempV = v.trim()
    return tempV === '' ? k : `${k}="${tempV}"`
})

const tagNameAttrsToText = ({name, attribs}) => [name, ...attribsToPlainText(attribs)].filter(v => v).join(' ')

const tagNameAttrsTextToHtml = (node, text) => {
    if(singleTags.includes(node.name)) {
        return `<${tagNameAttrsToText(node)}>`
    }
    return `<${tagNameAttrsToText(node)}>${text}</${node.name}>`
}

const getSpace = (deep, indent_size = 4) => ' '.repeat(indent_size * deep)

const getInnerHtml = arr => {
    let arrTemp = []
    arr.forEach((v, i) => {
        const {type, name, attribs, children, data = ''} = v
        const node = {name, type, attribs, data}
        if(type === 'text') {
            arrTemp.push(data)
        }
        if(type === 'comment') {
            arrTemp.push(`<!-- ${data.trim().replace(/\n/g, '')} -->`)
        }
        if(type === 'tag') {
            arrTemp.push(tagNameAttrsTextToHtml(node, getInnerHtml(children)))
        }
    })
    return arrTemp.join('')
}

const renderVue = (arr, deep = -1) => {
    deep++
    let str = []
    arr.forEach((v, i) => {
        const {type, name, attribs, children, data} = v
        const node = {name, type, attribs, data: ''}
        if(type === 'tag') {
            if(children) {
                if(children.some(v => v.type === 'tag')) {
                    str.push(`\n${getSpace(deep)}<${tagNameAttrsToText(node)}>`)
                    str.push(`${getSpace(deep + 1)}${renderVue(children.filter(v => {
                        if(v.type === 'text') {
                            return v.data.trim().replace(/\n/g, '')
                        }
                        if(v.type === 'tag') {
                            return true
                        }
                    }), deep)}`)
                    str.push(`\n${getSpace(deep)}</${name}>`)
                }else {
                    const childrenText = children.filter(v => v.type === 'text' && v.data !== '\n').map(v => v.data.trim()).join('')
                    if(singleTags.includes(name)) {
                        str.push(`\n${getSpace(deep)}<${tagNameAttrsToText(node)}>`)
                    }else {
                        str.push(`\n${getSpace(deep)}<${tagNameAttrsToText(node)}>${childrenText}</${name}>`)
                    }
                }
            }
        }
        if(type === 'text') {
            const text = data.trim().replace(/\n/g, '')
            if(text) {
                str.push(`\n${getSpace(deep)}${text}`)
            }
        }
        if(type === 'comment') {

        }
    })
    return str.join('')
}

const formatText = (text, lang, node) => new Promise((resolve, reject) => {
    try{
        const content = prettierFormat(text, {parser: lang})
        if(node) {
            resolve(tagNameAttrsTextToHtml(node, `\n${content}`))
        }else {
            resolve(content)
        }
    }catch(e) {
        reject(e)
    }
})

const formatVueTemplate = text => new Promise((resolve, reject) => {
    const pureText = text.split('\n').filter(v => v.trim()).map(v => v.trim()).join('\n')
    const handler = new htmlparser.DomHandler((err, dom) => {
        if(err) {
            reject(err)
        }else {
            const domTemplate = dom.find(v => v.type === 'tag' && v.name === 'template')
            removeCircular(domTemplate)
            const strFormated = renderVue([domTemplate]).split('\n').filter(v => v.trim()).map(v => v.replace(/\s+$/,'')).join('\n')
            resolve(strFormated)
        }
    })
    const parser = new htmlparser.Parser(handler, {
        lowerCaseTags: false,
        lowerCaseAttributeNames: false,
        recognizeSelfClosing: true
    })
    parser.parseComplete(pureText)
    // parser.parseComplete(`<template>${pureText}</template>`)
})

const formatVueFile = rawText => new Promise((resolve, reject) => {
    const handler = new htmlparser.DomHandler((err, dom) => {
        if(err) {
            console.log(err)
        }else {
            removeCircular(dom)

            const promiseList = []

            const strTemplate = getInnerHtml(dom.filter(v => v.name === 'template'))

            promiseList.push(formatVueTemplate(strTemplate))

            dom.filter(v => v.name === 'script').forEach((v, i) => {
                if(v.children.length) {
                    const strScript = v.children[0].data
                    promiseList.push(formatText(strScript, 'babylon', {name: 'script', attribs: {}}))
                }
            })

            dom.filter(v => v.name === 'style').forEach((v, i) => {
                if(v.children.length) {
                    const attribs = only(v.attribs, ['lang', 'scoped'])
                    const strStyle = v.children[0].data
                    promiseList.push(formatText(strStyle, 'css', {name: 'style', attribs}))
                }
            })

            Promise.all(promiseList)
            .then(rs => {
                const content = rs.join('\n\n') + '\n'
                resolve(content)
            })
            .catch(e => reject(e))
        }
    })

    const parser = new htmlparser.Parser(handler, {
        lowerCaseTags: false,
        lowerCaseAttributeNames: false,
        recognizeSelfClosing: true
    })
    parser.parseComplete(rawText)
})

const formatAnyFile = file => new Promise((resolve, reject) => {
    const fileType = file.split('.').slice(-1)[0]
    console.log(fileType);
    const lang = prettierLangs[fileType]
    const rawText = fs.readFileSync(file).toString()
    if(!lang) {
        resolve({file, content: rawText})
        return
    }
    if(fileType === 'vue') {
        formatVueFile(rawText)
        .then(content => {
            resolve({file, content})
        })
        .catch(e => reject({file, errMsg: e}))
    }else {
        formatText(rawText, lang)
        .then(content => {
            resolve({file, content})
        })
        .catch(e => reject({file, errMsg: e}))
    }
})

module.exports = {formatAnyFile}
