const walk = require('acorn/dist/walk');
const myWalker = require('./util/myWalker');

// a walker that visits each id with varBlock
const varWalker= walk.make({
    Function: function (node, vb, c) {
        const innerVb = node.body['@block'];
        if (node.id) c(node.id, innerVb);
        for (let i = 0; i < node.params.length; i++)
            c(node.params[i], innerVb);
        c(node.body, innerVb);
    },
    TryStatement: function (node, vb, c) {
        c(node.block, vb);
        if (node.handler) {
            c(node.handler, vb);
        }
        if (node.finalizer) {
            c(node.finalizer, vb);
        }
    },
    CatchClause: function (node, vb, c) {
        const catchVb = node.body['@block'];
        c(node.param, catchVb);
        c(node.body, catchVb);
    },
    VariableDeclaration: function (node, vb, c) {
        for (let i = 0; i < node.declarations.length; ++i) {
            const decl = node.declarations[i];
            c(decl.id, vb);
            if (decl.init) c(decl.init, vb);
        }
    }
});

function findIdentifierAt(ast, pos) {
    "use strict";

    function Found(node, state) {
        this.node = node;
        this.state = state;
    }

    // find the node
    const walker = myWalker.wrapWalker(varWalker,
        (node, vb) => {
            if (node.start > pos || node.end < pos) {
                return false;
            }
            if (node.type === 'Identifier' && node.name !== '✖') {
                throw new Found(node, vb);
            }
            return true;
        });

    try {
        walk.recursive(ast, ast['@block'], walker);
    } catch (e) {
        if (e instanceof Found) {
            return e;
        } else {
            throw e;
        }
    }
    // identifier not found
    return null;
}

/**
 *
 * @param ast - scope annotated AST
 * @param {number} pos - character position
 * @returns {*} - array of AST nodes
 */
function findVarRefsAt(ast, pos) {
    "use strict";
    const found = findIdentifierAt(ast, pos);
    if (!found) {
        // pos is not at a variable
        return null;
    }
    // find refs for the id node
    const refs = findRefsToVariable(ast, found);

    return refs;
}

/**
 *
 * @param ast - scope annotated AST
 * @param found - node and varBlock of the variable
 * @returns {Array} - array of AST nodes
 */
function findRefsToVariable(ast, found) {
    "use strict";
    const varName = found.node.name;
    const vb1 = found.state.findVarInChain(varName);
    const refs = [];

    const walker = walk.make({
        Identifier: (node, vb) => {
            if (node.name !== varName) return;
            if (vb1 === vb.findVarInChain(varName)) {
                refs.push(node);
            }
        }
    }, varWalker);

    walk.recursive(vb1.originNode, vb1, walker);
    return refs;
}

exports.findIdentifierAt = findIdentifierAt;
exports.findVarRefsAt = findVarRefsAt;