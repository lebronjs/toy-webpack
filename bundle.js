const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const babel = require("@babel/core");

const getModuleInfo = (file) => {
  const body = fs.readFileSync(file, { encoding: "utf-8" });
  // 解析es模块为ast树
  const ast = parser.parse(body, {
    sourceType: "module",
  });
  // 收集依赖
  const deps = {};
  traverse(ast, {
    ImportDeclaration({ node }) {
      const dirname = path.dirname(file);
      const abspath = "./" + path.join(dirname, node.source.value);
      deps[node.source.value] = abspath;
    },
  });
  // es6的ast 转成 es5的代码
  const { code } = babel.transformFromAst(ast, null, {
    presets: ["@babel/preset-env"],
  });
  // 返回这个模块的相关内容
  const moduleInfo = { file, deps, code };
  return moduleInfo;
};
// 递归循环模块里的依赖
const parseModules = (file) => {
  const entry = getModuleInfo(file);
  const temp = [entry];
  const depsMap = {};
  for (let i = 0; i < temp.length; i++) {
    const deps = temp[i].deps;
    if (deps) {
      for (const key in deps) {
        if (deps.hasOwnProperty(key)) {
          temp.push(getModuleInfo(deps[key]));
        }
      }
    }
  }
  // 数据格式化
  temp.forEach((moduleInfo) => {
    depsMap[moduleInfo.file] = {
      deps: moduleInfo.deps,
      code: moduleInfo.code,
    };
  });
  return depsMap;
};

const bundle = (file) => {
  const depsMapString = JSON.stringify(parseModules(file));
  return `(function(depMap){
            function require(file){
                function absRequire(relPath){
                    return require(depMap[file].deps[relPath])
                }
                var exports = {};
                (function (require,exports,code){
                    eval(code)
                })(absRequire, exports, depMap[file].code)
                return exports
            }
            require('${file}')
        })(${depsMapString})`;
};

const content = bundle(path.join("./src", "index.js"));
const distDir = path.resolve(__dirname, "dist");
const dist = fs.existsSync(distDir);

!dist && fs.mkdirSync(distDir);
fs.writeFileSync(path.join(distDir, "bundle.js"), content);

// fs.appendFileSync(path.resolve(__dirname, "dist/bundle.js"), content);
// console.log(content);
