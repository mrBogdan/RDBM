class NodeValue {
  constructor() {
    this.key = 0;
    this.value = null;
  }
}

class Node {
  constructor() {
    this.nodes = [];
  }

  addNodeValue(nodeValue) {
    this.keys.push(nodeValue);
  }
}

class BTree {
  constructor() {
    this.root = new Node();
  }

  addNode(node) {
    this.root.addNodeValue(node);
  }
}

// a -> 1 2 3 4

// 3 <- 4 -> 2 -> 1


