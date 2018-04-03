const o = require('objutil')
const {isArray} = Array
const {assign, keys} = Object

const ERR_DUPLICATE = 'ERR_DUPLICATE'

function MODB (dataArray, indexDef, config = {}) {
  this.config = assign({
    idKey: 'id', notKey: '$not'
  }, config)
  indexDef = assign({
    [this.config.idKey]: {unique: true}
  }, indexDef)

  this.clear()
  if (!isArray(dataArray)) dataArray = []
  this.data = dataArray
  if (indexDef) {
    keys(indexDef).forEach(key => this.createIndex(key, indexDef[key]))
  }
}

// class methods
MODB.prototype.clear = function () {
  // data is Array, item is Object, always increase(push)
  // when remove, just set to null, don't use DELETE!!!
  // https://www.smashingmagazine.com/2012/11/writing-fast-memory-efficient-javascript/
  this.data = []
  this.index = Object.create(null)
  this.indexDef = Object.create(null)
}

MODB.prototype.createIndex = function (key, def) {
  const {data, index, indexDef} = this
  let idx
  if (!isNaN(def)) {
    idx = def + 0
    def = indexDef[key] || {}
  } else {
    def = indexDef[key] = def || indexDef[key] || {}
  }

  if (def.skip) return {ok: 0}

  const keyObj = index[key] = index[key] || Object.create(null)
  const createFn = i => {
    const v = data[i]
    if (v == null) return

    const parts = key.split('.$.')
    let arr = o.got(v, parts[0])
    if (isArray(arr)) {
      for (let i = 1;i < parts.length;i++) {
        let t = []
        arr.forEach(x => (t = t.concat(o.got(x, parts[i]))))
        arr = t
      }
    }else {
      arr = [arr]
    }

    arr.forEach(id => {
      // assign index data code block
      // const id = o.got(v, key)
      if (def.multiple) {
        let arr = keyObj[id]
        if (!isArray(arr)) arr = keyObj[id] = []
        arr.push(i)
      } else {
        keyObj[id] = i
      }
    })
  }

  if (idx == null) data.forEach((v, i) => createFn(i))
  else createFn(idx)
  return {ok: 1}
}

MODB.prototype.find = function (key, id, returnIndex) {
  const {data, index, config} = this
  const {notKey} = config

  const keyObj = index[key]
  if (keyObj == null) { // null:deleted,  undefined:not exists
    return
  }

  // $not?
  if (!o.isPrimitive(id) && notKey in id) {
    const allIDs = keys(keyObj)
    const srcArr = [].concat(id[notKey]).map(String)
    id = allIDs.filter(x => srcArr.indexOf(x) === -1)
  }

  let d = isArray(id)
    ? [].concat.apply([], id.map(i => keyObj[i])) // flatten if {'parentID.id':[2,3]}
    : keyObj[id]

  if (returnIndex) return d
  return isArray(d)
    ? d.map(i => data[i]).filter(Boolean)
    : data[d]
}

MODB.prototype.findMany = function (cond, returnIndex) {
  if (!cond) return
  const arr = []
  return isArray(cond)
    ? (cond.forEach(x => addToSet(arr, this.findCond(x, returnIndex))), arr)
    : this.findCond(cond, returnIndex)
}

MODB.prototype.findCond = function (obj, returnIndex) {
  /*
  obj: Object { id:1, 'parentID.id':[2,3] }
  return $and of condition
  */
  let ret
  for (let key in obj) {
    let val = obj[key]
    if (!o.own(obj, key) || val == null) continue
    // to match null, pass val='null'
    const arr = [].concat(this.find(key, val, returnIndex))
    if (ret == null) ret = arr
    else ret = ret.filter(x => arr.indexOf(x) > -1)
  }
  return isArray(ret) ? ret.filter(Boolean) : []
}

MODB.prototype.insert = function (obj, opt = {}) {
  if (obj == null) return {ok: 0}
  const {data, index, indexDef, config} = this
  const { skipUnique={} } = opt

  if (!(config.idKey in obj)) return {
      error: 'insert new object lost ' + config.idKey
  }
  const i = data.length
  data[i] = null // in case insert failed, indexObj will point to null
  for (let key in indexDef) {
    const def = indexDef[key]
    if (def == null) continue

    // assign index data code block
    const id = o.got(obj, key)
    if (def.unique && !(skipUnique.key == key && skipUnique.id == id)
      && !isEmptyData(this.find(key, id))) return {
        error: 'duplicate key of ' + key + ', id:' + id,
        code: ERR_DUPLICATE,
      key, id}
  }

  data[i] = obj

  keys(indexDef).forEach(key => this.createIndex(key, i))

  return {ok: 1}
}

MODB.prototype.delete = function (key, id) {
  const d = this.find(key, id, true)
  if (isEmptyData(d)) return {ok: 0}

  const prev = isArray(d) ? d.map(x => this.data[x]) : this.data[d]

  if (isArray(d)) d.forEach(i => this.data[i] = null) // never delete!
  else this.data[d] = null
  return {ok: 1, dataIndex: d, deleted: prev}
}

MODB.prototype.update = function (key, id, newItem, config = {}) {
  if (newItem == null) return {ok: 0}
  const {data, indexDef} = this
  const def = indexDef[key] || {}

  if (!def.unique) return {
      error: 'update can only update unique key, but the key is ' + key
  }

  const {replace, upsert} = config
  const {dataIndex, deleted: prev} = this.delete(key, id)
  const restore = () => !isNaN(dataIndex) && (data[dataIndex] = prev)

  if (!isEmptyData(prev)) {
    newItem = replace ? newItem : assign({}, prev, newItem)
  } else if (!upsert) {
    restore()
    return {
      error: 'update cannot find previous item'
    }
  }

  const insertResult = this.insert(newItem)
  if (!insertResult.ok) restore()

  return insertResult
}

// export the class
module.exports = MODB

function isEmptyData (obj) {
  return obj == null
    || isArray(obj) && obj.length == 0
}

function addToSet (arr, arr2) {
  arr2.forEach(item => arr.indexOf(item) < 0 && arr.push(item))
}
