'use strict';

// external deps 
var ObjectId = require('mongodb').ObjectId;

// internal deps
require('mongodb-toolkit');
var BateeqModels = require('bateeq-models');
var map = BateeqModels.map;

var PaymentType = BateeqModels.posmaster.PaymentType;
//var generateCode = require('../../utils/code-generator');
 
module.exports = class PaymentTypeManager {
    constructor(db, user) {
        this.db = db;
        this.user = user;
        this.paymentTypeCollection = this.db.use(map.posmaster.PaymentType);
    }

    read(paging) {
        var _paging = Object.assign({
            page: 1,
            size: 20,
            order: '_id',
            asc: true
        }, paging);

        return new Promise((resolve, reject) => {
            var deleted = {
                _deleted: false
            };
            var query = _paging.keyword ? {
                '$and': [deleted]
            } : deleted;

            if (_paging.keyword) {
                var regex = new RegExp(_paging.keyword, "i");
                var filterCode = {
                    'code': {
                        '$regex': regex
                    }
                };
                var filterName = {
                    'name': {
                        '$regex': regex
                    }
                };
                var $or = {
                    '$or': [filterCode, filterName]
                };

                query['$and'].push($or);
            }


            this.paymentTypeCollection
                .where(query)
                .page(_paging.page, _paging.size)
                .orderBy(_paging.order, _paging.asc)
                .execute()
                .then(paymentTypes => {
                    resolve(paymentTypes);
                })
                .catch(e => {
                    reject(e);
                });
        });
    }

    getById(id) {
        return new Promise((resolve, reject) => {
            if (id === '')
                resolve(null);
            var query = {
                _id: new ObjectId(id),
                _deleted: false
            };
            this.getSingleByQuery(query)
                .then(paymentType => {
                    resolve(paymentType);
                })
                .catch(e => {
                    reject(e);
                });
        });
    }

    getByIdOrDefault(id) {
        return new Promise((resolve, reject) => {
            if (id === '')
                resolve(null);
            var query = {
                _id: new ObjectId(id),
                _deleted: false
            };
            this.getSingleOrDefaultByQuery(query)
                .then(paymentType => {
                    resolve(paymentType);
                })
                .catch(e => {
                    reject(e);
                });
        });
    }

     getByCode(code) {
        return new Promise((resolve, reject) => {
            var query = {
                code: code,
                _deleted: false
            };
            this.getSingleByQuery(query)
                .then(paymentType => {
                    resolve(paymentType);
                })
                .catch(e => {
                    reject(e);
                });
        });
    }

    getSingleByQuery(query) {
        return new Promise((resolve, reject) => {
            this.paymentTypeCollection
                .single(query)
                .then(paymentType => {
                    resolve(paymentType);
                })
                .catch(e => {
                    reject(e);
                });
        })
    }

    getSingleOrDefaultByQuery(query) {
        return new Promise((resolve, reject) => {
            this.paymentTypeCollection
                .singleOrDefault(query)
                .then(paymentType => {
                    resolve(paymentType);
                })
                .catch(e => {
                    reject(e);
                });
        })
    }

    create(paymentType) {
        return new Promise((resolve, reject) => {
            //paymentType.code = generateCode("paymentType");
            this._validate(paymentType)
                .then(validPaymentType => {
                    this.paymentTypeCollection.insert(validPaymentType)
                        .then(id => {
                            resolve(id);
                        })
                        .catch(e => {
                            reject(e);
                        })
                })
                .catch(e => {
                    reject(e);
                })
        });
    }

    update(paymentType) {
        return new Promise((resolve, reject) => {
            this._validate(paymentType)
                .then(validPaymentType => {
                    this.paymentTypeCollection.update(validPaymentType)
                        .then(id => {
                            resolve(id);
                        })
                        .catch(e => {
                            reject(e);
                        })
                })
                .catch(e => {
                    reject(e);
                })
        });
    }

    delete(paymentType) {
        return new Promise((resolve, reject) => {
            this._validate(paymentType)
                .then(validPaymentType => {
                    validPaymentType._deleted = true;
                    this.paymentTypeCollection.update(validPaymentType)
                        .then(id => {
                            resolve(id);
                        })
                        .catch(e => {
                            reject(e);
                        })
                })
                .catch(e => {
                    reject(e);
                })
        });
    }
 
    _validate(paymentType) {
        var errors = {};
        return new Promise((resolve, reject) => {
            var valid = new PaymentType(paymentType);
            // 1. begin: Declare promises.
            var getPaymentType = this.paymentTypeCollection.singleOrDefault({
                "$and": [{
                    _id: {
                        '$ne': new ObjectId(valid._id)
                    }
                }, {
                        code: valid.code
                    }]
            });
            // 1. end: Declare promises.

            // 2. begin: Validation.
            Promise.all([getPaymentType])
                .then(results => {
                    var _paymentType = results[0];

                    if (!valid.code || valid.code == '')
                        errors["code"] = "code is required";
                    else if (_paymentType) {
                        errors["code"] = "code already exists";
                    }

                    if (!valid.name || valid.name == '')
                        errors["name"] = "name is required"; 

                    // 2c. begin: check if data has any error, reject if it has.
                    for (var prop in errors) {
                        var ValidationError = require('../../validation-error');
                        reject(new ValidationError('data does not pass validation', errors));
                    }

                    valid.stamp(this.user.username, 'manager');
                    resolve(valid);
                })
                .catch(e => {
                    reject(e);
                })
        });
    }
};