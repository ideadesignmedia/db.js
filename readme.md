db.js is a light and powerful cache-level database. It uses promises to fulfill database queries. Create a new database by importing the db class from the module and creating a new db specifying a database name


BASIC USAGE:

Example:
const { db } = require('db.js')
const database = new db('Main')

This will create a folder for the databases' files.
You can specify this folder by setting an environment variable process.env.DBPATH = './database'
The database name will set the save file for that data.

db.js stores documents using it's Data class which automatically generates a unique _id for the entry.

save(null || data || items) - Each time the save function is called it saves the current database state to the local disk.

Example:
database.save().catch(e => console.log(e)) // Saves the current database to the local disk.

You can save a document to the database

Example:
const { Data } = require('db.js')
let readyData = new Data({ name: 'Sam', color: 'blue' })
database.save(readyData).then(result => {
    console.log(result) // {_id: 'new_id', name: 'Sam', color: 'blue'}
})

You can also save an array of items to the database

Example:
let users = [{ name: 'Sam' }, { name: 'Lucy' }, { name: 'Jim' }]
database.save(users.map(u => new Data(u))).then(r => {
    console.log(r) //number of saved items?
})

In order to avoid long creation times, consider using the push method for items which needn't persist between instances.
Usually you would just use the save function to acheive this.

Example:
let data = [{ name: 'Sam' }, { name: 'Ed' }, { name: 'Galen' }]
for (let i = 0; i < data.length; i++) {
    database.push(new Data(data[i])).then(r => {
        console.log(r) // {...data[i], _id: 'new_id'}
    }).catch(e => console.log(e))
}
database.save().catch(e => console.log(e))

To retreive your documents you will use queries:
1. describe an object with the traits you wish to retrieve - { name: 'Sam' }
2. use a function to return the results you wish to retrieve - (data) => data.name === 'Sam'
3. describe an object with functions to validate the data - {name: (name) => name === 'Sam'}

find(query) - Returns the first document that matches the query

Example:
database.find({ name: 'Sam' }).then(result => {
    console.log(result) // returns the first object that has the name: 'Sam'
})

Example:
database.find(a => a.name === 'Sam').then(result => {
    console.log(result) // will return the first document with the name === 'Sam' || null
})

findAll(query) - Return all documents that match query
Example:
database.findAll({ name: 'Sam' }).then(result => {
    console.log(result) // returns all objects that have the name: 'Sam'
})

Example:
database.findAll(a => a.name === 'Sam').then(result => {
    console.log(result) // will return the list of all documents with the name === 'Sam' || []
})


Use the delete and deleteMany methods to delete documents from the database

delete(_id) - takes in the _id of the document to be deleted

Example: 
database.delete('new_id').then(result => {
    console.log(result) //the deleted document || null if nothing was deleted
})

deleteMany(query) - takes in a query object/function to determine which documents to be deleted

Example:
database.deleteMany(data => data.name === 'Sam').then(result => {
    console.log(result) // array of deleted documents || []
})


MODELS

The Model class extends the Data class by adding a unique model name to the document and offers data validation.
Like the Data class the first argument for the constructor is the data to be created. The second argument is the name of the model. The third argmuent is the validation function for the model's data, taking in the data and throwing an Error if the validation fails.

Example:
const { Model } = require('./db')
function userValidation(data) {
    if (!data) throw new Error('Missing data')
    if (!data.email) throw new Error('Missing Email')
}
let user = new Model({ email: 'test@example.com' }, 'User', userValidation)
console.log(user) // {_id: 'new_id', email: 'test@example.com', _m: 'User'}
user = new Model({ name: 'Sam' }, 'User', userValidation)
// The above line will cause an error that says "Missing Email"
console.log(user)

To better interact with the model class you can create another class that wraps around the Model offering increased functionality by passing in the database instance, name, and validator.

createModel(database, name, validator) - create model with a name, validators and methods

Example:
//Create User Class
const { db, createModel } = require('db.js')
const database = new db('Main')
function userValidation(data) {
    if (!data) throw new Error('Missing data')
    if (!data.email) throw new Error('Missing Email')
}
const User = createModel(database, 'user', userValidation)

Now that you have created the User class you can use it to handle the 'user' Model
The class that createModel created can be used for saving, finding, and deleting items with the 'user' model

Example:
let user = new User({ name: 'Sam' })
console.log(user) // {_doc: {_id: 'new_id', name: 'Sam', _m: 'user'}}

You will see that the result is a class with a _doc property that is the new document that we created.
If the data is not valid it will throw an error as is described in the validation function.
We can use the class' save method to save it's current document. This will return the result as tho we did database.save on a Data object.

Example: 
user.save().then(result => {
    console.log(result) // {_id: 'new_id', name: 'Sam', _m: 'user'}
})

We can use the class to locate a user or all users.

Example:
let instance = new User
instance.find('new_id').then(user => {
    if (!user) return console.log('No User Found')
    return console.log(user) // {name: 'Sam', _id: 'new_id', _m: 'user'}
}).catch(e => console.log(e))

Example:
let instance = new User
instance.findAll().then(result => {
    console.log(result) // List of all users || []
})

We can use the class to delete a user by _id, by query, or all users

Example:
//Delete user by _id
let instance = new User
instance.delete('new_id').then(r => {
    console.log(r) // deleted user || null
})

Example:
//Delete user by query
let instance = new User
instance.deleteOne({ name: 'Sam' }).then(r => {
    console.log(r) // deleted user || null
})

Example:
//Delete all users with name 'Sam'
instance.deleteMany({ name: 'Sam' }).then(r => {
    console.log(r) // deleted users || []
})

Example:
//Delete all users
instance.deleteMany({}).then(r => {
    console.log(r) // deleted users || []
})


createModels(database, models) - get an object with unique models from a array of templates

Example:
const { db, createModels } = require('db.js')
const database = new db('Main')
const modelTemplates = [
    {
        name: 'user',
        validator: function (data) {
            if (!data.email) throw new Error('Missing email')
        }
    },
    {
        name: 'payment',
        validator: function (data) {
            if (!data.amount) throw new Error('Missing amount')
            if (data.amount < 0) throw new Error('Payments should have positive amounts')
            if (!data.user) throw new Error('Missing user that payment is associated with')
        }
    }
]
// NOTE: model name determines object key case
const models = createModels(database, modelTemplates) // {user: [Class], payment: [Class]}
// You can now destructure into individual models or access them as models.user etc.
const { payment, user } = models


MANAGEMENT METHODS
reduceData(function) - Takes in a function to reduce the data by.

Example:
//reduce database to items with unique names and remove items if their name is already in the database.
database.reduceData((dataSet, dataItem) => {
    if (!dataSet.find(data => data.name === dataItem.name)) dataSet.push(dataItem)
    return dataSet
}, [])


filterData(function) - Takes in a function to filter the data by

Example:
//remove all items that have never been updated
database.filterData(data => {
    return !data._u
})


mapData(function) - Takes in a function to map the data

Example:
// Change all items to have the completed key set to true
database.mapData(data => {
    return { ...data, completed: true }
})

manage(function, time) - set an interval for the database to perform a function call - works like setInterval

Example:
//delete all temporary records from database every minute
let time = 1000 * 60 // 1 minute in milliseconds
database.manage(function () {
    database.deleteMany({ temp: true }).then(deleted => {
        console.log(deleted)
    }).catch(e => console.log(e))
}, time)


runRecords() - The database can be set to compensate for large documents using the runRecords function.
Note: For documents which will not fit inside of memory, a system of pointers should/has to be implemented.

Example:
// Do the runRecords function every one minute
database.manage(database.runRecords, 1000*60)

Documents that use the data key will treated as a large documents and the database will save a seperate document with the contents of the data field whenever the runRecords function is called as long as the data field is of type object.
 
Example:
database.save(new Data({ name: 'Sam', data: { document: LARGE_DOC_AS_STRING } })).then(result => {
    console.log(result)// {_id: 'new_id', name: 'Sam', data: {document: LARGE_DOC_AS_STRING}}
})

The next time runRecords is ran it will transform the record to put the large document into a file.
When you find these records they will automatically be returned with their data contents.

simpFind(query) - In order to find records without returning their full data contents, use the simpFind method to locate the documents. This will allow you to check if a record exists without having to wait for the contents to be retrieved off of the disk and put into memory.

Example:
database.simpFind({ name: 'Sam' }).then(result => {
    console.log(result) // {_id: 'new_id', name: 'Sam', data: null, _recordData: 'placedataislocated'}
})

To get only a record from the database, use the getRecord/readRecord methods.

getRecord(_id) - method takes in the _id of the record and returns just the record data

Example:
database.getRecord('new_id').then(result => {
    console.log(result) // {LARGE_DOCUMENT}
})


readRecord(address) - method takes in the _recordData address of the record and returns just the record data

Example:
database.readRecord('recordAddress').then(result => {
    console.log(result) // {LARGE_DOCUMENT}
})