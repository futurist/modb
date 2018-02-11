const o = require('objutil')
const {isArray} = Array
const {assign, keys} = Object

/*
  this.data: Array of Objects
  this.config: Object {
    idKey: 'id'  // default id index key
  }
  this.indexDef: Object {
    id: {unique: true},
    'parentID.id': {multiple: true}
  }
  this.index: Object {
    'id':{
      '1': 0,
      '2': 3,
    },
    'parentID.id':{
      '100': [5,6],
      '101': [7,8]
    }
  }
   */

const ERR_DUPLICATE = 'ERR_DUPLICATE'

function MemDB (dataArray, indexDef, config={}) {
  this.config = assign({
    idKey: 'id', notKey: '$not'
  }, config)
  indexDef = assign({
    [this.config.idKey]: {unique: true}
  }, indexDef)

  this.clear()
  if(isArray(dataArray)) {
    this.data = dataArray
  }
  if(indexDef){
    keys(indexDef).forEach(key=>this.createIndex(key, indexDef[key]))
  }
}

// class methods
MemDB.prototype.clear = function () {
  // data is Array, item is Object, always increase(push)
  // when remove, just set to null, not using DELETE!!!
  // https://www.smashingmagazine.com/2012/11/writing-fast-memory-efficient-javascript/
  this.data = []
  this.index = Object.create(null)
  this.indexDef = Object.create(null)

}

MemDB.prototype.createIndex = function(key, def) {
  if(def===null) return {
    error: 'createIndex: empty definition, skip create index'
  }
  def = def || {}
  const {data, index} = this
  if(key in index) return {
    error: 'createIndex: index already exists'
  }

  this.indexDef[key] = def
  const keyObj = index[key] = Object.create(null)
  data.forEach((v, i)=>{
    if(v==null) return

    const parts = key.split('.$.')
    let arr = o.got(v, parts[0])
    if(isArray(arr)) {
      for(let i=1;i<parts.length;i++){
        let t = []
        arr.forEach(x=> (t = t.concat(o.got(x, parts[i]))))
        arr = t
      }
    }else{
      arr = [arr]
    }
    
    arr.forEach(id=>{
      // assign index data code block
      // const id = o.got(v, key)
      if(def.multiple){
        let arr = keyObj[id]
        if(!isArray(arr)) arr = keyObj[id] = []
        arr.push(i)
      } else {
        keyObj[id] = i
      }
    })

  })
  return {ok: 1}
}

MemDB.prototype.find = function (key, id, returnIndex) {
  const {data, index, config} = this
  const {notKey} = config

  const keyObj = index[key]
  if (keyObj==null) {  // null:deleted,  undefined:not exists
    return
  }

  // $not?
  if(!o.isPrimitive(id) && notKey in id){
    const allIDs = keys(keyObj)
    const srcArr = [].concat(id[notKey]).map(String)
    id = allIDs.filter(x=> srcArr.indexOf(x)===-1)
  }

  let d = isArray(id)
    ? [].concat.apply([], id.map(i=>keyObj[i]))  // flatten if {'parentID.id':[2,3]}
    : keyObj[id]

  if(returnIndex) return d
  return isArray(d)
    ? d.map(i=>data[i]).filter(Boolean)
    : data[d]
}

MemDB.prototype.findMany = function (cond, returnIndex) {
  if(!cond) return
  const arr = []
  return isArray(cond)
  ? (cond.forEach(x=>addToSet(arr, this.findCond(x, returnIndex))), arr)
  : this.findCond(cond, returnIndex)
}

MemDB.prototype.findCond = function (obj, returnIndex) {
  /*
  obj: Object { id:1, 'parentID.id':[2,3] }
  return $and of condition
  */
  let ret
  for(let key in obj){
    let val = obj[key]
    if(!o.own(obj, key) || val==null) continue
    // to match null, pass val='null'
    const arr = [].concat(this.find(key, val, returnIndex))
    if(ret==null) ret = arr
    else ret = ret.filter(x=>arr.indexOf(x)>-1)
  }
  return isArray(ret) ? ret.filter(Boolean) : []
}

MemDB.prototype.insert = function (obj, opt={}) {
  if(obj==null) return {ok: 0}
  const {data, index, indexDef, config} = this
  const {skipUnique={}} = opt

  if(!(config.idKey in obj)) return {
    error: 'insert new object lost '+config.idKey
  }
  const i = data.length
  data[i] = null  // in case insert failed, indexObj will point to null
  for(let key in indexDef){
    const def = indexDef[key]
    const keyObj = index[key]
    if(def==null || keyObj==null) continue

    // assign index data code block
    const id = o.got(obj, key)
    if(def.unique && !(skipUnique.key==key && skipUnique.id==id)
      && !isEmptyData(this.find(key, id))) return {
      error: 'duplicate key of '+key+', id:'+id,
      code: ERR_DUPLICATE,
      key, id
    }
    if(def.multiple){
      let arr = keyObj[id]
      if(!isArray(arr)) arr = keyObj[id] = []
      arr.push(i)
    } else {
      keyObj[id] = i
    }

  }

  data[i] = obj

  return {ok: 1}
}


MemDB.prototype.delete = function (key, id) {
  const d = this.find(key, id, true)
  if(isEmptyData(d)) return {ok: 0}
  
  const prev = isArray(d) ? d.map(x=>this.data[x]) : this.data[d]

  if(isArray(d)) d.forEach(i=>this.data[i] = null)  // never delete!
  else this.data[d] = null
  return {ok: 1, dataIndex: d, deleted: prev}
}

MemDB.prototype.update = function (key, id, newItem, config={}) {
  if(newItem==null) return {ok: 0}
  const {data, indexDef} = this
  const def = indexDef[key]||{}

  if(!def.unique) return {
    error: 'update can only update unique key, but the key is '+key
  }

  const {replace, upsert} = config
  const {dataIndex, deleted: prev} = this.delete(key, id)
  const restore = ()=>!isNaN(dataIndex) && (data[dataIndex] = prev)

  if(!isEmptyData(prev)){
    newItem = replace ? newItem : assign({}, prev, newItem)
  } else if(!upsert) {
    restore()
    return {
      error: 'update cannot find previous item'
    }
  }

  const insertResult = this.insert(newItem)
  if(!insertResult.ok) restore()

  return insertResult
}

// export the class
module.exports = MemDB

function isEmptyData(obj){
  return obj==null
  || isArray(obj) && obj.length==0
}

function replaceObject(src, dest){
  for (let key in src) {
    if (src.hasOwnProperty(key)) {
      delete src[key]
    }
  }
  return Object.assign(src, dest)
}

function addToSet(arr, arr2){
  arr2.forEach(item=> arr.indexOf( item ) < 0 && arr.push( item ))
}
// var a=[]; addToSet(a, [1,2,3,2,1]); console.log(a)

