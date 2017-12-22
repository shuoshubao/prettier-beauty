#!/usr/bin/env node

const fs = require('fs')
const htmlparser = require('htmlparser2')
const {removeCircular, getInnerHtml, tagNameAttrsTextToHtml, only, formatText, formatVueTemplate} = require('./utils')


const rawVue = fs.readFileSync('./test/3.vue').toString()

const handler = new htmlparser.DomHandler((err, dom) => {
    if(err) {
        console.log(err)
    }else {
        removeCircular(dom)
        // fs.writeFileSync('./ast-3.js', JSON.stringify(dom, null, 4))

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
                promiseList.push(formatText(strStyle, 'less', {name: 'style', attribs}))
            }
        })

        Promise.all(promiseList)
        .then(rs => {
            const str = rs.join('\n\n') + '\n'
            fs.writeFileSync('./test/3.vue', str)
        })
        .catch(e => {
            console.log(e)
        })

    }
})

const parser = new htmlparser.Parser(handler, {
    lowerCaseTags: false,
    lowerCaseAttributeNames: false,
    recognizeSelfClosing: true
})
parser.parseComplete(rawVue)
