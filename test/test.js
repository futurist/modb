import db from '../'
import test from 'ava'
import util from 'util'
// import stream from '../stream'

var memwatch = require('memwatch-next')
memwatch.on('leak', function(info) {
  console.log('Memory Leak!!!', info)
})
memwatch.on('stats', function(info) {
  console.log(info)
})


test('init', t => {
  const data = [{id:1, a:2, c:3}, {id:2, a:5, c:6}]
  const d = new db(data)
  t.is(d.data, data)
  t.deepEqual(d.config, {
    idKey: 'id',
    notKey: '$not'
  })
  t.deepEqual(d.indexDef, {id: {
    unique: true
  }})
  t.deepEqual(d.index, {id: {
    1:0,
    2:1,
  }})
})


test('create Index', t => {
  const data = [
    {id:1, parentID:[{id:20}, {id:21}], c:3}, 
    {id:2, parentID:[{id:20}, {id:23}], c:4}, 
  ]
  const d = new db(data, {
    'parentID.$.id': {multiple: true},
  })
  // console.log(util.inspect(d.index))
  t.deepEqual(d.index, {
    id:{
      1:0,
      2:1
    },
    'parentID.$.id':{
      20:[0,1],
      21: [0],
      23: [1]
    }
  })
})

function flatten (list) {
  // recursively flatten array
for (var i = 0; i < list.length; i++) {
  if (Array.isArray(list[i])) {
    list = list.concat.apply([], list)
      // check current index again and flatten until there are no more
      // nested arrays at that index
    i--
  }
}
return list
}

test('find', t => {
  const data = [
    {id:1, parentID:{id:2}, c:3}, 
    {id:2, parentID:{id:2}, c:6}, 
    {id:3, parentID:{id:3}, c:7},
    {id:4, c:8},
  ]
  const d = new db(data, {
    'parentID.id': {multiple: true},
    'parentID2.id': {multiple: true},
  })
  // console.log(
  //   // util.inspect(d.index),
  //   d.find('parentID.id', [2,3])
  // )

  t.deepEqual(d.find('id', 2), data[1])
  t.deepEqual(d.find('id', 20), undefined)
  t.deepEqual(d.find('parentID.id', 2), [
    data[0], data[1]
  ])
  t.deepEqual(d.find('parentID.id', 'undefined'), [
    data[3]
  ])
  t.deepEqual(d.find('parentID.id', ['undefined', 3]), [
    data[3], data[2]
  ])
  t.deepEqual(d.find('parentID.id', [2,3]), [
    data[0], data[1], data[2]
  ])
})


test('find multiple', t => {
  const data = [
    {id:1, parentID:{id:2}, c:3}, 
    {id:2, parentID:{id:2}, c:6}, 
    {id:3, parentID:{id:3}, c:7}
  ]
  const d = new db(data, {
    'parentID.id': {multiple: true},
  })
  // console.log(util.inspect(d.index))

  t.deepEqual(d.find('id', [2, 20, 3]), [
    data[1], data[2]
  ])
  t.deepEqual(d.find('parentID.id', [1,2]), [
    data[0], data[1]
  ])
})


test('find $not', t => {
  const data = [
    {id:1, parentID:{id:2}, c:3}, 
    {id:2, parentID:{id:2}, c:6}, 
    {id:3, parentID:{id:3}, c:7}
  ]
  const d = new db(data)
  // console.log(util.inspect(d.index))

  t.deepEqual(d.find('id', {$not: 3}), [
    data[0], data[1]
  ])
  t.deepEqual(d.find('id', {$not: null}), [
    data[0], data[1], data[2]
  ])
  t.deepEqual(d.find('id', {$not: [2, 20, 3]}), [
    data[0]
  ])
})


test('findCond', t => {
  const data = [
    {id:1, parentID:{id:2}, c:3}, 
    {id:2, parentID:{id:2}, c:6}, 
    {id:3, parentID:{id:3}, c:7}
  ]
  const d = new db(data, {
    'parentID.id': {multiple: true}
  })
  // console.log(util.inspect(d.index))

  t.deepEqual(d.findCond({
    id: [1,2,3],
    'parentID.id': 3
  }), [
    data[2]
  ])

  t.deepEqual(d.findCond({
    id: [1,2],
    'parentID.id': 3
  }), [
    
  ])

})

test('findCond with null', t => {
  const data = [
    {id:1, parentID:{id:2}, c:3}, 
    {id:2, parentID:{id:2}, c:6}, 
    {id:3, parentID:{id:3}, c:3}
  ]
  const d = new db(data, {
    'parentID.id': {multiple: true},
    c: {multiple: true}
  })
  // console.log(util.inspect(d.index))

  t.deepEqual(d.findCond({
    id: [1,2,3],
    'parentID.id': null
  }), [
    data[0],
    data[1],
    data[2]
  ])

  t.deepEqual(d.findCond({
    'parentID.id': undefined,
    c: 3
  }), [
    data[0],
    data[2]
  ])

})

test('findMany', t => {
  const data = [
    {id:1, parentID:{id:2}, c:3}, 
    {id:2, parentID:{id:2}, c:6}, 
    {id:3, parentID:{id:3}, c:7}
  ]
  const d = new db(data, {
    'parentID.id': {multiple: true}
  })
  // console.log(util.inspect(d.index))

  t.deepEqual(d.findMany([{
    id: [1,2,3],
    'parentID.id': 3
  }, {
    id: 1
  }]), [
    data[2], data[0]
  ])

  t.deepEqual(d.findMany([{
    id: {$not: 3},
    'parentID.id': 3
  }]), [
    
  ])

})


test('delete', t => {
  const data = [
    {id:1, parentID:{id:2}, c:3}, 
    {id:2, parentID:{id:2}, c:6}, 
    {id:3, parentID:{id:3}, c:7}
  ]
  const d = new db(data)
  t.deepEqual(d.delete('id', 1).ok, 1)
  t.is(data[0], null)
})

test('insert', t => {
  const data = [
    {id:1, parentID:{id:2}, c:3}, 
    {id:2, parentID:{id:2}, c:6}, 
  ]
  const newItem = {id:3, parentID:{id:3}, c:7}
  const d = new db(data, {
    'parentID.id': {multiple: true}
  })
  t.deepEqual(d.insert(newItem), {ok:1})
  t.deepEqual(d.find('id',3), newItem)

  t.deepEqual(d.index, {
    id: {
      1:0, 2:1, 3:2
    },
    'parentID.id':{
      2: [0,1], 3: [2]
    }
  })

})


test('insert unique', t => {
  const data = [
    {id:1, parentID:{id:2}, c:3}, 
    {id:2, parentID:{id:2}, c:6}, 
  ]
  const newItem = {id:2, parentID:{id:3}, c:7}
  const d = new db(data)
  t.true(!!d.insert(newItem).error)
})

test('update - basic 1', t => {
  const data = [
    {id:1, parentID:{id:2}, c:3}, 
    {id:2, parentID:{id:2}, c:6}, 
  ]
  const newItem = {id:3, parentID:{id:3}, c:7}
  const d = new db(data, {
    'parentID.id': {multiple:1}
  })
  t.true(!!d.update('id', 2, newItem).ok)
  t.deepEqual(d.data, [
    {id:1, parentID:{id:2}, c:3}, 
    null,
    {id:3, parentID:{id:3}, c:7}
  ])
  t.is(d.find('id',2), null)
  t.deepEqual(d.find('parentID.id',2), [
    {id:1, parentID:{id:2}, c:3}
  ])
  t.deepEqual(d.index, {
    id:{
      1:0,
      2:1,
      3:2
    },
    'parentID.id':{
      2: [0,1],
      3: [2]
    }
  })
})


test('update - basic 2', t => {
  const data = [
    {id:1, parentID:{id:2}, c:3}, 
    {id:2, parentID:{id:2}, c:6}, 
  ]
  const newItem = {parentID:{id:3}, x:9}
  const d = new db(data, {
    'parentID.id': {multiple:1}
  })

  t.true(/cannot find/.test(d.update('id', 3, newItem).error))

  t.true(!!d.update('id', 2, newItem).ok)

  t.deepEqual(d.data, [
    {id:1, parentID:{id:2}, c:3}, 
    null,
    {id:2, parentID:{id:3}, c:6, x:9}
  ])

  // console.log(util.inspect( d.find('id',2) ))
  
  t.deepEqual(d.find('id',2), { id: 2, parentID: { id: 3 }, c: 6, x: 9 })
  
  t.deepEqual(d.find('parentID.id',2), [
    {id:1, parentID:{id:2}, c:3}
  ])
  t.deepEqual(d.index, {
    id:{
      1:0,
      2:2,
    },
    'parentID.id':{
      2: [0,1],
      3: [2]
    }
  })
})


test('update - replace/upsert', t => {
  const data = [
    {id:1, parentID:{id:2}, c:3}, 
    {id:2, parentID:{id:2}, c:6}, 
  ]
  const newItem = {id:3, parentID:{id:3}, x:9}
  const d = new db(data)
  d.update('id', newItem.id, newItem, {replace:true, upsert:true})
  // console.log(util.inspect(d.data))
  t.deepEqual(d.data, [
    {id:1, parentID:{id:2}, c:3}, 
    {id:2, parentID:{id:2}, c:6}, 
    newItem
  ])

  const newItem2 = {id:2, parentID:{id:3}, x:9}
  d.update('id', newItem2.id, newItem2, {replace:true, upsert:true})
  t.deepEqual(d.data, [
    {id:1, parentID:{id:2}, c:3}, 
    null,
    newItem,
    newItem2
  ])
})

test('update - replace/upsert with multiple key', t => {
  const data = [
    {id:1, parentID:{id:2}, c:3}, 
    {id:2, parentID:{id:2}, c:6}, 
  ]
  const newItem = {id:2, parentID:{id:3}, x:9}
  const newItem4 = {id:4, parentID:{id:3}, x:9}
  const d = new db(data, {
    'parentID.id': {multiple:1}
  })

  const config = {upsert:1, replace:1}
  // console.log(
  //   // d.update('id', 3, newItem, config),
  //   // d.update('id', 2, newItem, config),
  //   util.inspect( d.data )
  // )


  t.true(/duplicate/.test(d.update('id', 3, newItem, config).error))
  t.true(d.update('id', 3, newItem4, config).ok==1)

  d.delete('id', 4)

  t.true(d.update('id', 2, newItem, config).ok==1)

  t.deepEqual(d.data, [
    {id:1, parentID:{id:2}, c:3}, 
    null,
    null,
    null,
    newItem
  ])

  // console.log(util.inspect( d.find('id',2) ))
  
  t.deepEqual(d.find('id',2), { id: 2, parentID: { id: 3 }, x: 9 })
  
  t.deepEqual(d.index, {
    id:{
      1:0,
      2:4,
      4:3,
    },
    'parentID.id':{
      2: [0, 1],  // 1 -> null
      3: [3, 4]
    }
  })

  t.deepEqual(d.find('parentID.id',2), [
    {id:1, parentID:{id:2}, c:3}
  ])

})

test('find perf', t=>{
  const {heapUsed} = process.memoryUsage()
  const arr = Array.from({length: 1e6}, (val,id) => ({
    id, n: Math.random()*100
  }) )
  const dd = new db(arr)
  const beginTime = +new Date
  console.time('find perf')
  for(let i=10000;i<20000;i++){
    dd.find('id', i)
  }
  console.timeEnd('find perf')
  t.true(+new Date-beginTime < 100)
  console.log('memory usage:', process.memoryUsage().heapUsed - heapUsed)
})
