# db.js
## ABOUT
-----------
db.js is a flexible and powerful cache-level database build with NodeJS.
Set your server to use encryption each time data is stored on the disk.
Configure to store large javascript objects such as historical stock data.

## INSTALLATION
----------------
`npm install @ideadesignmedia/db.js` or `yarn add @ideadesignmedia/db.js`

## BASIC USAGE
----------------
### Creating/Loading a database
`new db(name, encryptionKey, encryptionBuffer)` - Create a new database by importing the db class from the module and creating a new db specifying a database name.

Example:
```
const { db } = require('@ideadesignmedia/db.js')
const database = new db('Main')
```

Initialize the database using encryption and use the same key to load the database each time. The key is required for encryption and must be 32 characters in length.
The Buffer is optional. If included, the Buffer must be 16 characters.

Example:
```
const { db } = require('@ideadesignmedia/db.js')
const database = new db('Main', process.env.DBKEY, process.env.DBBUFFER)
```

This will create a folder for the databases' files.
You can specify this folder by setting an environment variable before constructing a new database
`process.env.DBPATH = './database'`
The database name will set the save file for that data.

### Saving data to the database
-----------
db.js stores documents using it's Data class which automatically generates a unique _id for the entry.

#### `save(null || data || items)`
Each time the save function is called it saves the current database state to the local disk.
Example:
```
database.save().catch(e => console.log(e)) // Saves the current database to the local disk.
```
**Save a document to the database:**
```
const { Data } = require('@ideadesignmedia/db.js')
let readyData = new Data({ name: 'Sam', color: 'blue' })
database.save(readyData).then(result => {
    console.log(result) // {_id: 'new_id', name: 'Sam', color: 'blue'}
})
```
**Save an array of items to the database:**
```
let users = [{ name: 'Sam' }, { name: 'Lucy' }, { name: 'Jim' }]
database.save(users.map(u => new Data(u))).then(r => {
    console.log(r) //number of saved items?
})
```

#### `push(Data)`
**In order to avoid long creation times, consider using the push method for items which needn't be added to the disk immediately:**
```
let data = [{ name: 'Sam' }, { name: 'Ed' }, { name: 'Galen' }]
for (let i = 0; i < data.length; i++) {
    database.push(new Data(data[i])).then(r => {
        console.log(r) // {...data[i], _id: 'new_id'}
    }).catch(e => console.log(e))
}
database.save().catch(e => console.log(e))
```

### Querying documents
-----------
To retreive your documents you will use queries structured one of three ways:
1. Describe an object with the traits you wish to retrieve - `{ name: 'Sam' }`
2. Use a function to return the results you wish to retrieve - `(data) => data.name === 'Sam'`
3. Describe an object with functions to validate the data - `{name: (name) => name === 'Sam'}`

#### `find(query)`
Returns the first document that matches the query

Example:
```
database.find({ name: 'Sam' }).then(result => {
    console.log(result) // returns the first object that has the name: 'Sam'
})
```

Example:
```
database.find(a => a.name === 'Sam').then(result => {
    console.log(result) // will return the first document with the name === 'Sam' || null
})
```

#### `findAll(query)`
**Return all documents that match query:**
```
database.findAll({ name: 'Sam' }).then(result => {
    console.log(result) // returns all objects that have the name: 'Sam'
})
```
Example:
```
database.findAll(a => a.name === 'Sam').then(result => {
    console.log(result) // will return the list of all documents with the name === 'Sam' || []
})
```

### Deleting documents:
-----------
Use the delete and deleteMany methods to delete documents from the database

#### `delete(_id)`
Takes in the _id of the document to be deleted.

Example:
```
database.delete('new_id').then(result => {
    console.log(result) //the deleted document || null if nothing was deleted
})
```

#### `deleteMany(query)`
Takes in a query object/function to determine which documents to be deleted

Example:
```
database.deleteMany(data => data.name === 'Sam').then(result => {
    console.log(result) // array of deleted documents || []
})
```

### Modeling data
-----------
#### `Model(data, name, validation)`
The Model class extends the Data class by adding a unique model name to the document and offers data validation.
Like the Data class the first argument for the constructor is the data to be created. The second argument is the name of the model. The third argmuent is the validation function for the model's data, taking in the data and throwing an Error if the validation fails.

Example:
```
const { Model } = require('@ideadesignmedia/db.js')
function userValidation(data) {
    if (!data) throw new Error('Missing data')
    if (!data.email) throw new Error('Missing Email')
}
let user = new Model({ email: 'test@example.com' }, 'User', userValidation)
console.log(user) // {_id: 'new_id', email: 'test@example.com', _m: 'User'}
user = new Model({ name: 'Sam' }, 'User', userValidation)
// The above line will cause an error that says "Missing Email"
console.log(user)
```

**To better interact with the Model class you can create another class that wraps around the Model offering increased functionality by passing in the database instance, name, and validator.**

#### `createModel(database, name, validator)`
Creates a new class that extends the model class that will help template and validate modeled data.

Example:
```
const { db, createModel } = require('@ideadesignmedia/db.js')
const database = new db('Main')
function userValidation(data) {
    if (!data) throw new Error('Missing data')
    if (!data.email) throw new Error('Missing Email')
}
const User = createModel(database, 'user', userValidation)
const Users = new User
```

Now that you have created the User class you can use it to handle the 'user' Model.
The ModelClass that the createModel function created can be used for saving, finding, and deleting items with the 'user' model.

Example:
```
let user = new User({ name: 'Sam' })
console.log(user) // {_doc: {_id: 'new_id', name: 'Sam', _m: 'user'}}
user.save().then(result => {
    console.log(result) // {_id: 'new_id', name: 'Sam', _m: 'user'}
})
```

You will see that the result is a ModelClass with a _doc property that is the new document that we created and the _doc is an instance of the Model class.
If the data is not valid it will throw an error as is described in the validation function.
We can use the class' save method to save it's current document. This will return the result as tho we did database.save on a Data object.

We can use the ModelClass to locate a user or all users.

Example:
```
Users.find('new_id').then(user => {
    if (!user) return console.log('No User Found')
    return console.log(user) // {name: 'Sam', _id: 'new_id', _m: 'user'}
}).catch(e => console.log(e))
```

Example:
```
Users.findAll().then(result => {
    console.log(result) // List of all users || []
})
```

We can use the ModelClass to delete a user by _id, by query, or all users

**Delete a user with the _id 'new_id':**
```
Users.delete('new_id').then(r => {
    console.log(r) // deleted user || null
})
```
**Delete a user with the name 'Sam':**
```
Users.delete({ name: 'Sam' }).then(r => {
    console.log(r) // deleted user || null
})
```
**Delete all users using the 'user' ModelClass with the name 'Sam':**
```
Users.deleteMany({ name: 'Sam' }).then(r => {
    console.log(r) // deleted users || []
})
```
**Delete all users using the 'user' ModelClass:**
```
Users.deleteMany({}).then(r => {
    console.log(r) // deleted users || []
})
```

#### `createModels(database, models)` - get an object with unique ModelClasses from a array of templates.
**NOTE: the template name determines object key case.**

Example:
```
const { db, createModels } = require('@ideadesignmedia/db.js')
const database = new db('Main')
const modelTemplates = [
    {
        name: 'user',
        validator: async function (data) {
            if (!data.email) throw new Error('Missing email')
            let user = await db.find({email: data.email, _m: 'user'}).catch(e => console.log(e))
            if (user) throw new Error('User already exists')
            if (!user.type) user.type = 'web'
            return user
        }
    },
    {
        name: 'payment',
        validator: async function (data) {
            if (!data.amount) throw new Error('Missing amount')
            if (data.amount < 0) throw new Error('Payments should have positive amounts')
            if (!data.user) throw new Error('Missing user that payment is associated with')
            let user = await db.find({_id: data.user}).catch(e => console.log(e))
            if (!user) throw new Error('User does not exist')
        }
    }
]
const models = createModels(database, modelTemplates) // {user: [Class], payment: [Class]}
// You can now destructure into individual models or access them as models.user etc.
const { payment, user } = models
```

**NOTE: Wrap Model constructors in a try catch to prevent throwing unhandled exceptions from validator functions:**
```
let user
try {
    user = new User(data)
} catch(e) {
    //Handle error from validator.
}
```

**Wrap in the construct function to return the new model as a promise:**
```
const {construct} = require('@ideadesignmedia/db.js')
construct(Model, data).save().then(result => {
    console.log(result)
}).catch(e => {
    //Handle error from validator.
})
```

## MANAGING THE DATABASE
-----------
#### `reduceData(function)`
Takes in a function to reduce the data by.
Reduce database to items with unique names and remove items if their name is already in the database.
Example:
```
database.reduceData((dataSet, dataItem) => {
    if (!dataSet.find(data => data.name === dataItem.name)) dataSet.push(dataItem)
    return dataSet
}, [])
```

#### `filterData(function)`
Takes in a function to filter the data by
Remove all items that have never been updated.
Example:
```
database.filterData(data => {
    return !data._u
})
```

#### `mapData(function)`
Takes in a function to map the data
Change all items to have the completed key set to true.
Example:
```
database.mapData(data => {
    return { ...data, completed: true }
})
```

#### `manage(function, time)`
Set an interval for the database to perform a function call - works like setInterval
Delete all records with the temp key set to true from database every minute.
Example:
```
let time = 1000 * 60 // 1 minute in milliseconds
database.manage(function () {
    database.deleteMany({ temp: true }).then(deleted => {
        console.log(deleted)
    }).catch(e => console.log(e))
}, time)
```

#### `runRecords()`
The database can be set to compensate for large documents using the runRecords function.
**Note: For documents which will not fit inside of memory, a system of pointers should/has to be implemented.**
Do the runRecords function every one minute:
```
database.manage(database.runRecords, 1000*60)
```
Documents that use the data key will treated as a large documents and the database will save a seperate document with the contents of the data field whenever the runRecords function is called as long as the data field is of type object.
Example:
```
database.save(new Data({ name: 'Sam', data: { document: LARGE_DOC_AS_STRING } })).then(result => {
    console.log(result) // {_id: 'new_id', name: 'Sam', data: {document: LARGE_DOC_AS_STRING}}
})
```
The next time runRecords is ran it will transform the record to put the large document into a file.
When you find these records they will automatically be returned with their data contents.

#### `simpFind(query)`
In order to find records without returning their full data contents, use the simpFind method to locate the documents. This will allow you to check if a record exists without having to wait for the contents to be retrieved off of the disk and put into memory.

Example:
```
database.simpFind({ name: 'Sam' }).then(result => {
    console.log(result) // {_id: 'new_id', name: 'Sam', data: null, _recordData: 'placedataislocated'}
})
```

**To get only a record from the database, use the getRecord/readRecord methods.**

#### `getRecord(_id)`
Method takes in the _id of the record and returns just the record data

Example:
```
database.getRecord('new_id').then(result => {
    console.log(result) // {LARGE_DOCUMENT}
})
```

#### `readRecord(address)`
Method takes in the _recordData address of the record and returns just the record data

Example:
```
database.readRecord('recordAddress').then(result => {
    console.log(result) // {LARGE_DOCUMENT}
})
```
