#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const glob = require('glob')
const {argv} = require('yargs')
const {formatAnyFile} = require('./utils')

const fileList = []

if(!fs.existsSync('./.git')) {
    console.log('请在项目根目录下运行此命令, 即.git所在目录')
    console.log('此命令会直接修改文件, 所以请先保证git工作区没有修改!!!')
    return
}

if(typeof argv.entry === 'string' && !argv.entry.includes('..')) {
    fileList.push(...glob.sync(path.join(__dirname, argv.entry) + '!(node_modules)**/**', {nodir: true}))
}else {
    console.log('请传入参数 entry, 且entry不得包含\'..\'')
    return
}

Promise.all(fileList.map(v => formatAnyFile(v)))
.then(rs => {
    rs.forEach(({file, content}) => fs.writeFileSync(file, content))
})
.catch(e => {
    console.log(e);
})

