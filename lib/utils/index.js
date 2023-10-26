const fs = require('fs');
const prettier = require('prettier');
const htmlparser = require('htmlparser2');
const { pick } = require('lodash');

// 默认选项
const prettierOptions = {
    parser: 'babel', // 'babel' | 'flow' | 'json' | 'typescript' | 'css' | 'json' | 'graphql' | 'markdown'
    useTabs: false,
    tabWidth: 4,
    printWidth: 160,
    semi: true, // 分号
    singleQuote: true, // 单引号
    trailingComma: 'none', // 尾逗号
    bracketSpacing: true, // true => { foo: bar }, false => {foo: bar}
    arrowParens: 'avoid', // 'avoid': x => x; 'always': (x) => x
    insertPragma: false // 在顶部插入注释 /** @format */
};

const prettierLangs = {
    js: 'babel',
    jsx: 'babel',
    vue: 'vue',
    css: 'css',
    scss: 'css',
    less: 'css',
    json: 'json',
    ts: 'typescript'
};

// 当属性过多时, 属性换行
const Max_Attributes_Per_Line = 5;

const prettierFormat = (str = '', option = {}) => {
    return prettier.format(str, {
        ...prettierOptions,
        ...option,
        singleQuote: option.parser !== 'css'
    });
};

// 单标签
const singleTags = [
    'area',
    'base',
    'basefont',
    'br',
    'col',
    'command',
    'embed',
    'frame',
    'hr',
    'img',
    'input',
    'isindex',
    'keygen',
    'link',
    'meta',
    'param',
    'source',
    'track',
    'wbr'
];

// 布尔属性
const booleanAttributes = [
    'allowfullscreen',
    'async',
    'autofocus',
    'autoplay',
    'checked',
    'controls',
    'default',
    'defer',
    'disabled',
    'hidden',
    'ismap',
    'loop',
    'multiple',
    'muted',
    'open',
    'readonly',
    'required',
    'reversed',
    'scoped',
    'seamless',
    'selected',
    'typemustmatch'
];

// 删除 parent, prev, next
const removeCircular = dom => {
    (Array.isArray(dom) ? dom : [dom]).forEach(v => {
        delete v.parent;
        delete v.prev;
        delete v.next;
        if (v.children && v.children.length) {
            removeCircular(v.children);
        }
    });
};

const attribsToText = attribs => {
    return Object.entries(attribs)
        .map(([k, v]) => {
            // console.log(k, v)
            let tempV = v;
            if (v === '') {
                return k;
            }
            if (k.startsWith('v-') || k.startsWith(':')) {
                // json放前面 因为会把单引号转成双引号
                /*
            try{
                tempV = prettierFormat(v, {parser: 'json'})
            }catch(e) {}
            */
                try {
                    tempV = prettierFormat(v, { parser: 'babel', semi: false });
                    if (tempV.startsWith(';')) {
                        tempV = tempV.replace(';', '');
                    }
                } catch (e) {}
            } else {
                if (v.includes(':')) {
                    try {
                        tempV = prettierFormat(v, { parser: 'css' });
                    } catch (e) {}
                }
            }

            tempV = tempV
                .split('\n')
                .map(v => v.trim())
                .filter(Boolean)
                .join('');

            return `${k}="${tempV}"`;
        })
        .join(' ');
};

const attribsToPlainText = attribs => {
    return Object.entries(attribs).map(([k, v]) => {
        return v === '' ? k : `${k}="${v}"`;
    });
};

const tagNameAttrsToText = ({ name, attribs }, deep = 0) => {
    if (deep) {
        const lenAttribs = Object.keys(attribs).length;
        if (lenAttribs >= Max_Attributes_Per_Line) {
            return [`${getSpace(deep)}<${name}`, ...attribsToPlainText(attribs).map(v => `${getSpace(deep + 1)}${v}`), `${getSpace(deep)}>`].join('\n');
        }
    }
    return `${getSpace(deep)}<${[name, ...attribsToPlainText(attribs)].filter(Boolean).join(' ')}>`;
};

const tagNameAttrsTextToHtml = (node, text) => {
    if (singleTags.includes(node.name)) {
        return tagNameAttrsToText(node);
    }
    return `${tagNameAttrsToText(node)}${text}</${node.name}>`;
};

const getSpace = (deep, indent_size = 4) => {
    return ' '.repeat(indent_size * deep);
};

const renderVue = (arr, deep = -1) => {
    deep++;
    let str = [];
    arr.forEach((v, i) => {
        const { type, name, attribs, children, data } = v;
        const node = { name, type, attribs, data: '' };
        if (type === 'tag') {
            if (children.some(v => v.type === 'tag')) {
                str.push(`\n${tagNameAttrsToText(node, deep)}`);
                str.push(
                    `${getSpace(deep + 1)}${renderVue(
                        children.filter(v => {
                            if (v.type === 'text') {
                                return v.data.trim().replace(/\n/g, '');
                            }
                            if (v.type === 'tag') {
                                return true;
                            }
                        }),
                        deep
                    )}`
                );
                str.push(`\n${getSpace(deep)}</${name}>`);
            } else {
                const childrenText = children
                    .filter(v => {
                        return v.type === 'text' && v.data !== '\n';
                    })
                    .map(v => v.data.trim())
                    .join('');
                if (singleTags.includes(name)) {
                    str.push(`\n${tagNameAttrsToText(node, deep)}`);
                } else {
                    str.push(`\n${tagNameAttrsToText(node, deep)}${childrenText}</${name}>`);
                }
            }
        }
        if (type === 'text') {
            const text = data.trim().replace(/\n/g, '');
            if (text) {
                str.push(`\n${getSpace(deep)}${text}`);
            }
        }
        if (type === 'comment') {
        }
    });
    return str.join('');
};

const formatText = (text, lang, node) => {
    return new Promise((resolve, reject) => {
        try {
            const content = prettierFormat(text, { parser: lang });
            if (node) {
                resolve(tagNameAttrsTextToHtml(node, `\n${content}`));
            } else {
                resolve(content);
            }
        } catch (e) {
            reject(e);
        }
    });
};

const formatVueTemplate = text => {
    return new Promise((resolve, reject) => {
        const pureText = text
            .split('\n')
            .map(v => v.trim())
            .filter(Boolean)
            .join('\n');
        const handler = new htmlparser.DomHandler((err, dom) => {
            if (err) {
                reject(err);
            } else {
                const domTemplate = dom.find(v => {
                    return v.type === 'tag' && v.name === 'template'
                });
                removeCircular(domTemplate);
                const strFormated = renderVue([domTemplate])
                    .split('\n')
                    .filter(v => v.trim())
                    .map(v => v.replace(/\s+$/, ''))
                    .join('\n');
                resolve(strFormated);
            }
        });
        const parser = new htmlparser.Parser(handler, {
            lowerCaseTags: false,
            lowerCaseAttributeNames: false,
            recognizeSelfClosing: true
        });
        parser.parseComplete(pureText);
    });
};

const formatVueFile = rawText => {
    return new Promise((resolve, reject) => {
        const handler = new htmlparser.DomHandler((err, dom) => {
            if (err) {
                console.log(err);
            } else {
                removeCircular(dom);

                const promiseList = [];

                if (dom.some(v => v.name === 'template')) {
                    const strTemplate = /<template>(\n|.)+<\/template>/.exec(rawText)[0];
                    promiseList.push(formatVueTemplate(strTemplate));
                }

                dom.filter(v => v.name === 'script').forEach((v, i) => {
                    if (v.children.length) {
                        const strScript = v.children[0].data;
                        promiseList.push(formatText(strScript, 'babel', { name: 'script', attribs: {} }));
                    }
                });

                dom.filter(v => v.name === 'style').forEach((v, i) => {
                    if (v.children.length) {
                        const attribs = pick(v.attribs, ['lang', 'scoped']);
                        const strStyle = v.children[0].data;
                        promiseList.push(formatText(strStyle, 'css', { name: 'style', attribs }));
                    }
                });

                Promise.all(promiseList)
                    .then(rs => {
                        const content = rs.join('\n\n') + '\n';
                        resolve(content);
                    })
                    .catch(e => reject(e));
            }
        });

        const parser = new htmlparser.Parser(handler, {
            lowerCaseTags: false,
            lowerCaseAttributeNames: false,
            recognizeSelfClosing: true
        });
        parser.parseComplete(rawText);
    });
};

const formatAnyFile = file => {
    return new Promise((resolve, reject) => {
        const fileType = file.split('.').slice(-1)[0];
        const lang = prettierLangs[fileType];
        if (!lang) {
            resolve({ file });
            return;
        }
        const rawText = fs.readFileSync(file).toString();
        if (fileType === 'vue') {
            formatVueFile(rawText)
                .then(content => {
                    resolve({ file, content });
                })
                .catch(e => reject({ file, errMsg: e }));
        } else {
            formatText(rawText, lang)
                .then(content => {
                    resolve({ file, content });
                })
                .catch(e => {
                    reject({ file, errMsg: e })
                });
        }
    });
};

module.exports = { prettierLangs, formatAnyFile };
