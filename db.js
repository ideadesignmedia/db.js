const fs = require('fs')
const p = require('path')
var data = [];
var DBPATH = process.env.DBPATH || './database'
var DBDEFAULT = p.resolve(p.join(DBPATH, 'data.json'))
var DB = ''
const init = db => {
    let dbTime = new Date()
    if (db) DB = p.resolve(p.join(DBPATH, db))
    if (!fs.existsSync(DBPATH)) { console.log('no dir'); fs.mkdirSync(DBPATH) }
    if (!fs.existsSync(DB || DBDEFAULT)) {
        fs.writeFileSync(DB || DBDEFAULT, JSON.stringify(data))
        console.log('NEW DATABASE DATA', (new Date() - (dbTime)))
    } else {
        console.log('READING DATABASE')
        data = JSON.parse(fs.readFileSync(DB || DBDEFAULT))
        console.log('DATABASE LOADED', (new Date() - (dbTime)))
    }
}
class Data {
    constructor(props) {
        let t = new Date()
        this.id = `${t.getFullYear()}${Math.round(Math.random() * 10000)}${t.getUTCDay().toString()}${t.getUTCHours().toString()}${t.getUTCMinutes().toString()}${t.getUTCMilliseconds()}`
        if (props && typeof props === 'object') {
            Object.entries(props).forEach(([key, value]) => {
                this[key] = value
            })
        }
        if (!this._t) {
            this._t = t
        } else {
            this._u = new Date
        }
    }
}
const compare = (a, b) => {
    if ((a && !b) || (b && !a) || (typeof a !== typeof b && (typeof a !== 'function' && typeof b !== 'function'))) return false
    if (typeof a.getTime === 'function') {
        if (a.getTime() !== b.getTime()) return false
        return true
    } else if (typeof a === 'function' || typeof b === 'function') {
        if (typeof a === 'function') {
            return a(b)
        } else {
            return b(a)
        }
    } else if (typeof a === 'object') {
        if (Array.isArray(a)) {
            if (a.length !== b.length) return false
            for (let i = 0; i < a.length; i++) {
                let j = false
                for (let o = 0; o < b.length; o++) {
                    if (compare(a[i], b[o])) {
                        j = true
                        o = b.length
                    }
                }
                if (j === false) return false
            }
            return true
        } else {
            let c = Object.entries(a)
            let d = Object.entries(b)
            if (c.length !== d.length) return false
            for (let i = 0; i < c.length; i++) {
                let j = false
                for (let o = 0; o < d.length; o++) {
                    if (compare(c[i], d[o])) {
                        j = true
                        o = d.length
                    }
                }
                if (j === false) return false
            }
            return true
        }
    }
    if (a !== b) return false
    return true
}
const readRecord = place => {
    return new Promise((res, rej) => {
        if (typeof place !== 'string') return rej('RECORD ADDRESS NOT OF TYPE STRING')
        try {
            res(JSON.parse(fs.readFileSync(place)))
        } catch (e) {
            return rej(`Failed to read ${place}: ${e}`)
        }
    })
}
const findData = obj => {
    return new Promise(async (res, rej) => {
        if (!obj || typeof obj !== 'object') {
            if (typeof obj === 'function') {
                for (let i = 0; i < data.length; i++) if (obj(data[i])) return res(data[i])
                return res(null)
            } else {
                return rej(`BAD QUERY: ${JSON.stringify(obj)}`)
            }
        }
        let id = obj.id || null
        let find = async d => {
            if (d.length > 1) {
                for (let i = 0; i < data.length; i++) {
                    let count = 0
                    for (let z = 0; z < d.length; z++) {
                        if (!data[i][d[z][0]]) { continue }
                        if (!compare(data[i][d[z][0]], d[z][1])) { continue } else { count++ }
                    }
                    if (count === d.length) return data[i]
                }
            } else {
                if (!d) return rej('EMPTY QUERY')
                for (let i = 0; i < data.length; i++) {
                    if (data[i][d[0][0]] && compare(data[i][d[0][0]], d[0][1])) return data[i]
                }
            }
            return res(null)
        }
        let complete
        if (id) {
            complete = await find(['id', id])
        } else {
            complete = await find(Object.entries(obj))
        }
        if (complete && complete.recordData) complete.data = await readRecord(complete.recordData).catch(e => {
            console.log(e)
            complete.recordData = null
            save(complete).then((result) => {
                return res(result)
            }).catch(e => {
                console.log(e)
                deleteData(complete.id).then(() => {
                    save().then(() => {
                        return rej('RECORD CORRUPTED. REMOVED.')
                    }).catch(e => {
                        console.log(e)
                        return rej('RECORD CORRUPTED.')
                    })
                }).catch(e => {
                    console.log(e)
                    return rej('RECORD CORRUPTED. FAILED TO REMOVE')
                })
            })
        })
        return res(complete)
    })
}
const simpFind = obj => {
    return new Promise(async (res, rej) => {
        if (!obj || typeof obj !== 'object') return rej('NO OBJECT')
        let results = []
        let keys = Object.entries(obj)
        for (let i = 0; i < data.length; i++) {
            let count = 0
            for (let o = 0; o < keys.length; o++) {
                if (!data[i][keys[o][0]]) continue
                let a = await compare(keys[o][1], data[i][keys[o][0]])
                if (a) { count++ }
            }
            if (count === keys.length) results.push(data[i])
        }
        return res(results)
    })
}
const findAll = (obj, opt) => {
    return new Promise(async (res, rej) => {
        let results = []
        if (!obj || typeof obj !== 'object') {
            if (typeof obj === 'function') {
                try {
                    for (let i = 0; i < data.length; i++) if (obj(data[i])) results.push(data[i])
                } catch (e) {
                    return rej(e)
                }
                return res(results)
            } else {
                return rej(`BAD QUERY: ${JSON.stringify(obj)}`)
            }
        }
        let keys = Object.entries(obj)
        let limit = opt && opt.limit ? opt.limit : Infinity
        let optionKeys = opt && opt.keys && typeof opt.keys === 'object' && opt.keys.length > 0 ? opt.keys : null
        for (let i = 0; i < data.length; i++) {
            let count = 0
            for (let o = 0; o < keys.length; o++) {
                if (!data[i][keys[o][0]]) continue
                let a = await compare(keys[o][1], data[i][keys[o][0]])
                if (a) { count++ }
            }
            if (count === keys.length) results.push(data[i])
            if (i >= limit - 1) i = Infinity
        }
        let reason = []
        for (let i = 0; i < results.length; i++) {
            if ((results[i].recordData && !optionKeys) || (optionKeys && optionKeys.includes('data') && results[i].recordData)) {
                results[i].data = await readRecord(results[i].recordData).catch(async e => {
                    console.log(e)
                    results[i].recordData = null
                    await save(results[i]).catch(e => {
                        console.log(e)
                        deleteData(u.id).then(() => {
                            save().then(() => {
                                console.log('RECORD CORRUPTED. REMOVED.', u.id)
                                return null
                            }).catch(e => {
                                console.log(e)
                                console.log('RECORD CORRUPTED.', u.id)
                                return null
                            })
                        }).catch(e => {
                            console.log(e)
                            console.log('RECORD CORRUPTED. FAILED TO REMOVE', u.id)
                            return null
                        })
                    })
                    return null
                })
            }
            if (optionKeys) {
                for (let z = 0; z < results.length; z++) {
                    let r = {}
                    for (let i = 0; i < optionKeys.length; i++) r[optionKeys[i]] = results[z][optionKeys[i]] ? results[z][optionKeys[i]] : null
                    reason.push(r)
                }
            } else {
                reason.push(results[i])
            }
        }
        return res(reason)
    })
}
const save = d => {
    return new Promise(async (res, rej) => {
        let s = () => {
            return new Promise((res, rej) => {
                try {
                    if (!fs.existsSync(DB || DBDEFAULT)) {
                        init()
                    } else {
                        let temp = p.resolve(p.join(DBPATH, 'temp.json'))
                        let final = DB || DBDEFAULT
                        fs.writeFileSync(temp, JSON.stringify(data))
                        fs.renameSync(temp, final)
                    }
                } catch (e) {
                    if (e && e.code === 'EPERM') {
                        return res(true)
                    } else {
                        return rej(e)
                    }
                } finally {
                    return res(d || true)
                }
            })
        }
        if (d && typeof d === 'object' && d instanceof Data) {
            let a = false
            for (let i = 0; i < data.length; i++) if (data[i].id === d.id) {
                data[i] = d
                a = true
                i = Infinity
            }
            if (!a) data.unshift(d)
        } else if (d && typeof d === 'object' && d instanceof Array) {
            for (let z = 0; z < d.length; z++) {
                if (d[z] && typeof d[z] === 'object' && d[z] instanceof Data) {
                    let a = false
                    for (let i = 0; i < data.length; i++) if (data[i].id === d[z].id) {
                        data[i] = d[z]
                        a = true
                        i = Infinity
                    }
                    if (!a) data.unshift(d[z])
                }
            }
        }
        s().then(result => {
            return res(result)
        }).catch(e => {
            return rej(e)
        })
    })
}
const pushData = d => {
    return new Promise((res, rej) => {
        if (!d || typeof d !== 'object' || !d instanceof Data) return rej('NOT OBJECT')
        data.push(d)
        return res(true)
    })
}
const deleteData = id => {
    return new Promise(async (res, rej) => {
        if (!id || typeof id !== 'string') return rej('NO ID TO DELETE')
        let result = null
        data = [...data].filter(u => {
            if (u.id === id) {
                result = u
                if (u.recordData) {
                    fs.unlink(u.recordData, () => { })
                    return false
                } else {
                    return false
                }
            } else {
                return true
            }
        })
        save().then(() => res(result)).catch(e => rej(e))
    })
}
const deleteMany = obj => {
    return new Promise(async (res, rej) => {
        let results = []
        let ar = [...data]
        if (!obj || typeof obj !== 'object') {
            if (typeof obj === 'function') {
                for (let i = 0; i < ar.length; i++) if (obj(ar[i])) results.push(ar[i])
            } else {
                return rej('NO OBJECT')
            }
        } else {
            let keys = Object.entries(obj)
            for (let i = 0; i < ar.length; i++) {
                let count = 0
                for (let o = 0; o < keys.length; o++) {
                    if (!ar[i][keys[o][0]]) continue
                    if (compare(keys[o][1], ar[i][keys[o][0]])) { count++ }
                }
                if (count === keys.length) results.push(ar[i])
            }
        }
        let ids = results.map(u => u.id)
        let z = []
        for (let i = 0; i < data.length; i++) {
            if (ids.includes(data[i].id)) {
                if (data[i].recordData) {
                    try {
                        await fs.unlinkSync(data[i].recordData)
                    } catch { }
                }
                z.push(data.splice(i, 1)[0])
                i--
            }
        }
        if (z < results.length) throw new Error('TO SHORT')
        save().then(() => res(z)).catch(e => rej(e))
    })
}
const filterData = func => {
    return new Promise((res, rej) => {
        data = [...data].filter(func)
        save().then(() => {
            return res(true)
        }).catch(e => {
            return rej(e)
        })
    })
}
const mapData = func => {
    return new Promise(async (res, rej) => {
        data = [...data].map(func)
        save().then(a => res(a)).catch(e => {
            return rej(`FAILED TO SAVE: ${e}`)
        })
    })
}
const reduceData = func => {
    return new Promise((res, rej) => {
        data = [...data].reduce(func, [])
        save().then(r => res(r)).catch(e => rej(e))
    })
}
const createRecord = (id, data) => {
    return new Promise((res, rej) => {
        if (!id) return rej('NO ID')
        if (!data || typeof data !== 'object') return rej('DATA MUST BE OF TYPE OBJECT')
        let recordbook = p.resolve(p.join(DBPATH, 'records'))
        if (!fs.existsSync(recordbook)) fs.mkdirSync(recordbook)
        let address = p.join(recordbook, `${id}.json`)
        fs.writeFile(address, JSON.stringify(data), err => {
            if (err) return rej(err)
            return res(address)
        })
    })
}
const checkRecord = id => {
    return new Promise((res, rej) => {
        if (!id) return rej('NO ID')
        findData({ id: id }).then(result => {
            if (result.recordData) {
                readRecord(result.recordData).then(result => {
                    if (!result) return res(true)
                    return res(false, result)
                }).catch(e => {
                    console.log(e)
                    return res(true)
                })
            } else {
                return rej({ record: true })
            }
        }).catch(e => {
            console.log(e)
            return rej('UNABLE TO FIND ENTRY')
        })
    })
}
const replaceRecord = (address, data) => {
    return new Promise(async (res, rej) => {
        let recordtemp = p.resolve(p.join(DBPATH, '/records/tmp'))
        if (!fs.existsSync(recordtemp)) await fs.mkdirSync(recordtemp)
        let tmp = address.split('/records/').join('/records/tmp/')
        fs.writeFile(tmp, JSON.stringify(data), async err => {
            if (err) return rej(e)
            try {
                await fs.renameSync(tmp, address)
            } catch (e) {
                return rej(e)
            } finally {
                return res(true)
            }
        })
    })
}
const runRecords = async () => {
    let m = [...data]
    for (let i = 0; i < m.length; i++) {
        if (m[i] && m[i].data && (typeof m[i].data === 'object') && !m[i].recordData) {
            let id = m[i].id
            let d = m[i].data
            m[i].recordData = await createRecord(id, d).catch(e => console.log(e))
            m[i].data = null
        } else if (m[i] && m[i].data && m[i].data !== null && typeof m[i].data === 'object' && m[i].recordData) {
            await replaceRecord(m[i].recordData, m[i].data).then(() => {
                m[i].data = null
            }).catch(e => {
                if (e && e.code !== 'ENOENT' && e.code !== 'EPERM') { console.log(e) }
            })
        }
    }
    data = m
    save().catch(e => console.log(e))
}
const manage = (func, timeframe) => {
    return new Promise((res) => {
        setInterval(func, timeframe ? timeframe : 1000 * 60 * 5)
        return res(true)
    })
}

module.exports = {
    init,
    save,
    find: findData,
    push: pushData,
    findAll,
    simpFind,
    compare,
    delete: deleteData,
    deleteMany,
    filterData,
    mapData,
    manage,
    runRecords,
    checkRecord,
    reduceData,
    Data
}