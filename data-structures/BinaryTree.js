import assert from 'node:assert';

const isNull = (value) => value === null;

class TreeNode {
  constructor(key, value) {
    this.key = key;
    this.value = value;
    this.left = null;
    this.rigth = null;
  }

  insert(node) {
    if (this.getKey() === node.getKey()) {
      return null;
    }

    if (node.key > this.key) {
      if (isNull(this.rigth)) {
        this.rigth = node;
      } else {
        this.rigth.insert(node);
      }
    } else {
      if (isNull(this.left)) {
        this.left = node;
      } else {
        this.left.insert(node);
      }
    }
  }

  getKey() {
    return this.key;
  }

  getRightBranch() {
    return this.rigth;
  }

  getLeftBranch() {
    return this.left;
  }

  getValue() {
    return this.value;
  }

  find(key) {
    const nodeKey = this.getKey();

    if (nodeKey === key) {
      return this;
    }

    if (key > nodeKey && !isNull(this.getRightBranch())) {
      return this.getRightBranch().find(key);
    }

    if (key < nodeKey && !isNull(this.getLeftBranch())) {
      return this.getLeftBranch(key);
    }

    return null;
  }
}

class BinaryTree {
  constructor() {
    this.root = null;
  }

  getRoot() {
    return this.root;
  }

  insert(node) {
    if (isNull(this.getRoot())) {
      this.root = node;
      return;
    }

    if (this.root.getKey() === node.getKey()) {
      return null;
    }

    this.root.insert(node);
  }

  find(key) {
    if (isNull(this.getRoot())) {
      return null;
    }

    return this.getRoot().find(key);
  }
}

const bt = new BinaryTree();

bt.insert(new TreeNode(10, 10));
bt.insert(new TreeNode(5, 5));

bt.insert(new TreeNode(15, 15));

bt.insert(new TreeNode(11, 11));

void function RunningTest() {
  const bt = new BinaryTree();

  bt.insert(new TreeNode(10, 10));
  bt.insert(new TreeNode(5, 5));
  bt.insert(new TreeNode(15, 15));
  bt.insert(new TreeNode(11, 11));

  const result = bt.find(11);

  assert.equal(result.getValue(), 11);
  assert.notEqual(result.getValue(), 12);
}();

void function SkipExistingValuesTest() {
  const bt = new BinaryTree();

  bt.insert(new TreeNode(10, 10));
  bt.insert(new TreeNode(5, 10));
  const result = bt.insert(new TreeNode(10, 11));
  const secondResult = bt.insert(new TreeNode(5, 10));

  assert.equal(result, null);
  assert.equal(secondResult, undefined);
}();