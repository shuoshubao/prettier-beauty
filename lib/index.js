#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');
const {argv} = require('yargs');
const {prettierLangs, formatAnyFile} = require('./utils');

const rootPath = process.cwd();
let fileList = [];

if (!fs.existsSync('./.git')) {
    console.log('请在项目根目录下运行此命令, 即.git所在目录');
    console.log('此命令会直接修改文件, 所以请先保证git工作区没有修改!!!');
    return;
}

if (
    typeof argv.entry === 'string' &&
    !argv.entry.includes('..') &&
    !argv.entry.includes('node_modules')
) {
    if (argv.entry.endsWith('/')) {
        argv.entry = argv.entry.slice(0, -1);
    }
    const entry = path.join(rootPath, argv.entry);
    const rootFileDir = glob.sync(rootPath + '/*').filter(v => {
        return !['node_modules'].some(v2 => v.endsWith(v2));
    });
    const rootFile = glob.sync(rootPath + '/*', {nodir: true}).filter(v => {
        return !['package.json'].some(v2 => v.endsWith(v2));
    });
    const rootDir = rootFileDir.filter(v => !rootFile.includes(v));
    if (argv.entry === '.') {
        fileList = rootDir.reduce((prev, cur) => {
            prev.push(...glob.sync(cur + '/**', {nodir: true}));
            return prev;
        }, rootFile);
    } else {
        if (fs.existsSync(entry)) {
            const stats = fs.statSync(entry);
            if (stats.isFile()) {
                fileList = [entry];
            } else {
                fileList = glob.sync(entry + '/**', {nodir: true});
            }
        }
    }
    fileList = fileList.filter(v => Object.keys(prettierLangs).some(v2 => v.endsWith(`.${v2}`)));
} else {
    console.log("请传入参数 entry, 且entry不得包含 '..' 和 'node_modules' ");
    return;
}

Promise.all(fileList.map(v => formatAnyFile(v)))
    .then(rs => {
        rs.forEach(({file, content}) => {
            content && fs.writeFileSync(file, content);
        });
    })
    .catch(e => {
        console.log(e);
    });
