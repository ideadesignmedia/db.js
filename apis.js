const {db, Data} = require('./db')
const ws = require('ws')
const reqIP = req => (req.headers['x-forwarded-for'] || req.connection.remoteAddress || '').split(',')[0].trim() || req.ip
const validate = auth => new Promise((res, rej) => {
   res(auth)
})
class api {
    constructor(dbname, port) {
        this.socks = []
        this.db = new db(dbname)
        this.server = new ws.Server({ port })
        this.server.on('connection', function connection(ws, req) {
            ws.IP = reqIP(req)
            ws.ID = 'WS' + Math.floor(Math.random() * 10000)
            let sock = { IP: ws.IP, ID: ws.ID }
            socks.push(sock)
            ws.reply = (e) => { ws.send(JSON.stringify(e)) }
            ws.on('close', function close() {
                for (let i = 0; i < socks.length; i++) {
                    if (socks[i].ID === ws.ID) {
                        let sock = socks.splice(i, 1)
                    }
                }
            })
            ws.on('message', async function message(message) {
                let that
                try {
                    that = JSON.parse(message && message.data ? message.data : message)
                } catch {
                    return
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
                            this.db.find(data).then(result => {
                                ws.reply({type: 'response', _id, data: result})
                            }).catch(e => {
                                ws.reply({type: 'error', _id, message: e})
                            })
                            break
                        }
                        case 'findAll': {
                            this.db.findAll(data).then(result => {
                                ws.reply({type: 'response', _id, data: result})
                            }).catch(e => {
                                ws.reply({type: 'error', _id, message: e})
                            })
                            break
                        }
                        case 'save': {                    
                            this.db.save(data ? new Data(data) : null).then(result => {
                                ws.reply({type: 'response', _id, data: result})
                            }).catch(e => {
                                ws.reply({type: 'error', _id, message: e})
                            })
                            break
                        }
                        case 'delete': {                    
                            this.db.delete(data).then(result => {
                                ws.reply({type: 'response', _id, data: result})
                            }).catch(e => {
                                ws.reply({type: 'error', _id, message: e})
                            })
                            break
                        }
                        case 'deleteOne': {                    
                            this.db.deleteMany(data).then(result => {
                                ws.reply({type: 'response', _id, data: result})
                            }).catch(e => {
                                ws.reply({type: 'error', _id, message: e})
                            })
                            break
                        }
                        case 'deleteMany': {                    
                            this.db.deleteMany(data).then(result => {
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
                            return
                        }
                    }
                } else {
                    ws.reply({ error: true, message: `Failed to send: ${data}` })
                }
            })
        })
    }
}
module.exports = api