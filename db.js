var dbTime = new Date()
const fs = require('fs')
var data = []
const makeDB = () => {
    if (!fs.existsSync('./database')) { console.log('no dir'); fs.mkdirSync('./database') }
    if (!fs.existsSync('./database/data.json')) {
        fs.writeFileSync('./database/data.json', data ? JSON.stringify(data) : '"[]"')
        console.log('NEW DATABASE DATA', (new Date() - (dbTime)))
    } else {
        console.log('READING DATABASE')
        data = JSON.parse(fs.readFileSync('./database/data.json'))
        console.log('DATABASE LOADED', (new Date() - (dbTime)))
    }
}
makeDB()
class Data {
    constructor(props) {
        if (props && typeof props === 'object') {
            Object.entries(props).forEach(([key, value]) => {
                this[key] = value
            })
        }
        let t = new Date()
        this.id = `${t.getFullYear()}${Math.round(Math.random() * 10000)}${t.getUTCDay().toString()}${t.getUTCHours().toString()}${t.getUTCMinutes().toString()}${t.getUTCMilliseconds()}`
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
        if (!obj || typeof obj !== 'object') return rej('NO OBJECT')
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
        if (!obj || typeof obj !== 'object') return rej('NO OBJECT')
        let results = []
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
        let save = () => {
            return new Promise((res, rej) => {
                try {
                    if (!fs.existsSync('./database/data.json')) {
                        makeDB()
                    } else {
                        fs.writeFileSync('./database/temp.json', JSON.stringify(data))
                        fs.renameSync('./database/temp.json', './database/data.json')
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
            let a
            a = await findData(d)
            if (!a) {
                data.push(d)
            } else {
                data = [...data].map(l => {
                    if (l.id === d.id) return d
                    return l
                })
            }
        }
        save().then(result => {
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
        let p = () => {
            return new Promise(async (res) => {
                let c = await [...data].filter(u => {
                    if (u.id === id) {
                        if (u.recordData) {
                            try {
                                fs.unlinkSync(u.recordData)
                            } catch (e) {
                                return false
                            } finally {
                                return false
                            }
                        } else {
                            return false
                        }
                    } else {
                        return true
                    }
                })
                return res(c)
            })
        }
        let o = await p().catch(e => rej(e))
        data = o
        save().then(() => res()).catch(e => rej(e))
    })
}
const deleteMany = obj => {
    return new Promise((res, rej) => {
        if (!obj || typeof obj !== 'object') return rej('NO OBJECT')
        let ar = [...data]
        let results = []
        let keys = Object.entries(obj)
        for (let i = 0; i < ar.length; i++) {
            let count = 0
            for (let o = 0; o < keys.length; o++) {
                if (!ar[i][keys[o][0]]) continue
                if (compare(keys[o][1], ar[i][keys[o][0]])) { count++ }
            }
            if (count === keys.length) results.push(ar[i])
        }
        let ids = results.map(u => u.id)
        let fil = async () => {
            let u = [...data]
            let z = []
            for (let i = 0; i < u.length; i++) {
                if (ids.includes(u[i].id)) {
                    if (u[i].recordData) {
                        try {
                            await fs.unlinkSync(u.recordData)
                        } catch {

                        }
                    }
                } else {
                    z.push(u[i])
                }
            }
            return z
        }
        fil().then(result => {
            data = result
            save().then(() => res(results.length)).catch(e => rej(e))
        }).catch(e => { return rej(e) })
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
        console.log('MAPPED')
        let a = await save().catch(e => {
            return rej(`FAILED TO SAVE: ${e}`)
        })
        console.log('saved')
        if (a) {
            return res(true)
        } else {
            return res(false)
        }
    })
}
const createRecord = (id, data) => {
    return new Promise((res, rej) => {
        if (!id) return rej('NO ID')
        if (!data || typeof data !== 'object') return rej('DATA MUST BE OF TYPE OBJECT')
        if (!fs.existsSync('./database/records')) fs.mkdirSync('./database/records')
        let address = `./database/records/${id}.json`
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
        if (!fs.existsSync('./database/records/tmp')) await fs.mkdirSync('./database/records/tmp')
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
    save: save,
    find: findData,
    push: pushData,
    findAll: findAll,
    simpFind: simpFind,
    compare: compare,
    delete: deleteData,
    deleteMany: deleteMany,
    filterData: filterData,
    mapData: mapData,
    manage: manage,
    runRecords: runRecords,
    Data: Data
}