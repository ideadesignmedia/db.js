const fs = require('fs')
let config = JSON.parse(fs.readFileSync('./config.json'))
if (typeof config === 'object' && config.length > 0) for (let i = 0; i < config.length; i++) if (config[i] && config[i].key && config[i].value) process.env[config[i].key] = config[i].value
const DB = require('./db')
global.db = new DB.db()
const { db } = global
const ws = require('ws')
const reqIP = req => (req.headers['x-forwarded-for'] || req.connection.remoteAddress || '').split(',')[0].trim() || req.ip
const wss = new ws.Server({ port: process.env.PORT || 3200 })
const validate = auth => new Promise((res, rej) => {
    res(auth) // return the _id of the user who is authenticated
})
var socks = []
wss.on('connection', function connection(ws, req) {
    ws.IP = reqIP(req)
    ws.ID = 'WS' + Math.floor(Math.random() * 10000)
    let sock = { IP: ws.IP, ID: ws.ID }
    socks.push(sock)
    console.log(`Current Client Count: ${socks.length} | Connected:  ${JSON.stringify(sock)}`)
    ws.reply = (e) => { ws.send(JSON.stringify(e)) }
    ws.on('close', function close() {
        for (let i = 0; i < socks.length; i++) {
            if (socks[i].ID === ws.ID) {
                let sock = socks.splice(i, 1)[0]
                console.log(`Current Client Count: ${socks.length} | Disconnected: ${JSON.stringify(sock)}`)
            }
        }
    })
    ws.on('message', async function message(message) {
        let that
        try {
            that = JSON.parse(message && message.data ? message.data : message)
        } catch (e) {
            return console.log(`RECEIVED DATA: ${JSON.stringify(message)}`)
        }
        if (that && that.type) {
            let { type, data, _id } = that
            switch (type) {
                case 'auth': {
                    if (typeof data !== 'object') return console.log('BAD AUTH')
                    if (!data.auth) {
                        return ws.reply({ type: 'auth', error: true })
                    } else {
                        let authenticated = await validate(data.auth).catch(e => console.log(e))
                        if (authenticated) {
                            for (let i = 0; i < socks.length; i++) if (socks[i].ID === ws.ID) {
                                socks[i].auth = data.auth;
                                socks[i]._id = authenticated
                            }
                            ws.reply({ type: 'auth', error: false })
                        } else {
                            ws.reply({ type: 'auth', error: true })
                        }
                    }
                    break
                }
                case 'find': {
                    db.find(data).then(result => {
                        ws.reply({type: 'response', _id, data: result})
                    }).catch(e => {
                        ws.reply({type: 'error', _id, message: e})
                    })
                    break
                }
                case 'findAll': {
                    db.findAll(data).then(result => {
                        ws.reply({type: 'response', _id, data: result})
                    }).catch(e => {
                        ws.reply({type: 'error', _id, message: e})
                    })
                    break
                }
                case 'save': {                 
                    db.save(data ? new DB.Data(data) : null).then(result => {
                        ws.reply({type: 'response', _id, data: result})
                    }).catch(e => {
                        ws.reply({type: 'error', _id, message: e})
                    })
                    break
                }
                case 'delete': {                  
                    db.delete(data).then(result => {
                        ws.reply({type: 'response', _id, data: result})
                    }).catch(e => {
                        ws.reply({type: 'error', _id, message: e})
                    })
                    break
                }
                case 'deleteOne': {                    
                    db.deleteMany(data).then(result => {
                        ws.reply({type: 'response', _id, data: result})
                    }).catch(e => {
                        ws.reply({type: 'error', _id, message: e})
                    })
                    break
                }
                case 'deleteMany': {                    
                    db.deleteMany(data).then(result => {
                        ws.reply({type: 'response', _id, data: result})
                    }).catch(e => {
                        ws.reply({type: 'error', _id, message: e})
                    })
                    break
                }
                case 'ping': {
                    ws.reply({ type: 'ping', data })
                    break
                }
                default: {
                    return console.log(that)
                }
            }
        } else {
            console.log('Failed to send', that)
            ws.reply({ error: true, message: `Failed to send: ${that}` })
        }
    })
})