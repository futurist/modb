# MODB
In Memory Object DataBase for JS.


[![npm](https://img.shields.io/npm/v/modb.svg "Version")](https://www.npmjs.com/package/modb)
[![Build Status](https://travis-ci.org/futurist/modb.svg?branch=master)](https://travis-ci.org/futurist/modb)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)


# Install

```
npm i modb-js -S
```

# Why

In JS, you should avoid below code:

```js
const arr = new Array(10000)
// ... ... fill arr with some objects
const item = arr.find(x=>x.id=='someid')  // --> NEVER DO THIS!

```

Above code will **froze(block)** your application totally if the array is large enough.

Instead, you should need some form of **In Memroy Database**, this lib is good if you store `Array of Object` in memory as a small database.

# Performance

With below sample array:

```js
// create your arr as normal, each object need have an id
const arr = Array.from({length: 1e6}, (val,id) => ({
    id, n: Math.random()*100
}))
```

Test of `find` item for `10000` times:

```js
const modb = require('modb-js')  // require the lib
const db = new modb(arr)  // create indexes

// A. vanilla .find
console.time('vanilla find')
for(let i=10000;i<20000;i++){
  arr.find(x=>x.id === i)
}
console.timeEnd('vanilla find')

// B. modb .find
console.time('modb find')
for(let i=10000;i<20000;i++){
  db.find('id', i)
}
console.timeEnd('modb find')
```

The result:

>vanilla find: 2659.199ms
>modb speed: **3.985ms**

# API

## const db = new MODB(arr, [indexDef], [options])
Create modb instance from existing array.

**Return**: _[Object]_ MODB instance, has `data, index, indexDef, config` key.

>**arr**: _[Array of objects]_ each object should have an `id` key.

>**indexDef**: _[Object]_ The key is index of the db, the value should below:
```
{unique: Boolean} true: The key is unique, and find result is 1 item.
{multiple: Boolean} true: The key is not unique, result is array of items.
{skip: Boolean} true: When create index, skip this key.
```

>**options**: _[Object]_ The key can be below:
```
{idKey: String} The default `id` key when create new MODB instance.
{notKey: String} The default `$not` key when find inverted results.
```

### example

```js
db = new modb(arr)  // default id is 'id', unique
db = new modb(arr, {a:{unique:true}, id:{skip:true}})  // using a as id, skip default 'id' as key.
db = new modb(arr, {'pid': {multiple: true}})  // create id as unique index, and pid as multiple index.
```

## db.createIndex(key, def)
Create new index from exists modb.

**Return**: _[Object]_
```
{
  ok: 0/1,  // 1: Success; 0: Fail
}
```

>**key** _[String]_ The key of index to create.

>**def** _[Object]_ The definition of index, same as `indexDef` when create modb.


## db.find(id, value, returnIndex)
Find result items, which `id` is `value`.

**Return**: _[Object/Array]_ If the `id` is unique, return single object, else return array of objects.

>**id** _[String]_ The key of object to find.

>**value** _[Any]_ The value of object[id] to find.

>**returnIndex** _[Boolean]_ Return index of item in array instead of item value.

### example

```js
db.find('id', 5)  // result of arr.find(x=>x.id==5)
db.find('pid', 5)  // ALL results of arr.find(x=>x.pid==5)
```


## db.findCond(object, returnIndex)
Find result items, from condition object.

**Return**: _[Array]_ Always return array of objects.

>**object** _[Object]_ `$and` of each `find` result.

>**returnIndex** _[Boolean]_ Return index of item in array instead of item value.

### example

```js
db.findCond({'id': 5, 'pid': 3})  // ALL results of arr.find(x=>x.id==5 && x.pid==3)
```

## db.findMany(condArr, returnIndex)
Find result items, from condition object/array of condition objects.

**Return**: _[Array]_ Always return array of objects.

>**condArr** _[Object/Array]_ If it's array, return `$or` of each condition object.

>**returnIndex** _[Boolean]_ Return index of item in array instead of item value.

### example

```js
db.findMany([{'pid': 3}, {'id': 5}])  // ALL results of arr.find(x=>x.id==5 || x.pid==3)
```

## db.insert(item)
Insert a new item into db.

**Return**: _[Object]_
```
{
  ok: 0/1,  // 1: Success; 0: Fail
}
```

>**item** _[Object]_ The object to insert.

### example

```js
db.insert({id: 6, x:11})  // insert a new item into db and arr
```

## db.delete(id, value)
Delete items from db.

**Return**: _[Object]_
```
{
  ok: 0/1,  // 1: Success; 0: Fail
  deleted: object  // deleted items
}
```

>**id** _[String]_ The key of object to delete.

>**value** _[Any]_ The value of object[id] to delete.

### example

```js
db.delete('id', 6)  // delete item of id==6 from db and arr
```

## db.update(id, value, newItem, [options])
Update item from db with newItem.

**Return**: _[Object]_
```
{
  ok: 0/1,  // 1: Success; 0: Fail
}
```

>**id** _[String]_ The key of object to update.

>**value** _[Any]_ The value of object[id] to update.

>**newItem** _[Object]_ The object to insert.

>**options** _[Object]_
```
{
  upsert: Boolean,  // true: insert newItem if the key/value cannot be found
  replace: Boolean,  // true: replace exists item with newItem
                     // false: Merge into exists item with newItem
}
```

### example

```js
db.update('id', 6, {x:12})  // merge {x:12} into id:6 from db and arr
db.update('id', 6, {id:6, y:12}, {replace: true})  // replace newItem with id:6 from db and arr
db.update('id', 6, {id:6, y:12}, {upsert: true})  // merge newItem of id:6 from db and arr, if not found, insert it.
```

