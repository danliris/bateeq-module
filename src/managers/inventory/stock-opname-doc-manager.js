'use strict';

// external deps 
var ObjectId = require('mongodb').ObjectId;
require('mongodb-toolkit');
var BaseManager = require('module-toolkit').BaseManager;
var BateeqModels = require('bateeq-models');
var map = BateeqModels.map;
var generateCode = require('../../utils/code-generator');

var SODoc = BateeqModels.inventory.StockOpnameDoc;
var SODocItem = BateeqModels.inventory.StockOpnameDocItem;
var TransInDoc = BateeqModels.inventory.TransferInDoc;
var TransInItem = BateeqModels.inventory.TransferInItem;
var TransOutDoc = BateeqModels.inventory.TransferOutDoc;
var TransOutItem = BateeqModels.inventory.TransferOutItem;

var moduleId = "EFR-SO/INT";

module.exports = class StockOpnameDocManager extends BaseManager {
    constructor(db, user) {
        super(db, user);
        this.collection = this.db.use(map.inventory.StockOpnameDoc);
        var StorageManager = require('../master/storage-manager');
        this.storageManager = new StorageManager(db, user);

        var ItemManager = require('../master/item-manager');
        this.itemManager = new ItemManager(db, user);

        var TransInManager = require('./transfer-in-doc-manager');
        this.transInManager = new TransInManager(db, user);

        var TransOutManager = require('./transfer-out-doc-manager');
        this.transOutManager = new TransOutManager(db, user);

        var InventoryManager = require('./inventory-manager');
        this.inventoryManager = new InventoryManager(db, user);
    }

    _getQuery(paging) {
        var _default = {
                _deleted: false
            },
            pagingFilter = paging.filter || {},
            keywordFilter = {},
            query = {};

        if (paging.keyword) {
            var regex = new RegExp(paging.keyword, "i");
            var createdAgentFilter = {
                "_createAgent": {
                    "$regex": regex
                }
            };
            var codeFilter = {
                "code": {
                    "$regex": regex
                }
            };
            var storageFilter = {
                "storage.name": {
                    "$regex": regex
                }
            };
            keywordFilter["$or"] = [createdAgentFilter, codeFilter, storageFilter];
        }
        query["$and"] = [_default, keywordFilter, pagingFilter];
        return query;
    }

    read(paging) {
        var _paging = Object.assign({
            page: 1,
            size: 20,
            order: {},
            filter: {},
            select: ["code", "_createdBy", "_createdDate", "storage.name", "isProcessed"]
        }, paging);
        var query = this._getQuery(_paging);
        return this.collection
            .where(query)
            .select(_paging.select)
            .page(_paging.page, _paging.size)
            .order(_paging.order)
            .execute();
    }

    create(valid){
        return new Promise((resolve, reject) => {
            var dataFile = valid.dataFile ? valid.dataFile : [];
            var errors = {};
            var data = [];
            var storageData = valid.storageId && ObjectId.isValid(valid.storageId) ? this.storageManager.getSingleByIdOrDefault(new ObjectId(valid.storageId)) : Promise.resolve(null);
            for(var a = 1; a < dataFile.length; a++){
                data.push({"code" : dataFile[a][0], "name" : dataFile[a][1], "qty" : dataFile[a][2]});
            }
            var dataItem = [];
            if(data.length > 0){
                var valueArr = data.map(function (item) { return item.code.toString() });
                var itemDuplicateErrors = new Array(valueArr.length);
                valueArr.some(function (item, idx) {
                    var index = valueArr.indexOf(item);
                    var itemError = {
                        "code" : valueArr[idx],
                        "error" : ""
                    };
                    if (index < idx) {
                        itemError.error = "Barcode sudah ada";
                    }
                    itemDuplicateErrors[idx] = itemError;
                });
                for(var a = 0; a < data.length; a++){
                    if(itemDuplicateErrors[a]["error"] === "" && itemDuplicateErrors[a]["code"] !== "" )
                        dataItem.push(this.itemManager.getSingleByQueryOrDefault({"code" : itemDuplicateErrors[a]["code"]}));
                }
            }
            if(dataItem.length === 0)
                dataItem.push(Promise.resolve(null));
            Promise.all([storageData].concat(dataItem))
                .then(results => {
                    var _storage = results[0];
                    var items = results.slice(1, results.length);
                    var dataError = [];
                    var newDate = new Date();
                    for(var a = 0; a < data.length; a++){
                        var Error = "";
                        if(data[a]["code"] === "" || data[a]["name"] === "" || data[a]["qty"] === "")
                            Error = Error + "Lengkapi data";
                        if(data[a]["code"] !== ""){ 
                            if(itemDuplicateErrors[a]["error"] !== "")
                                Error = Error + itemDuplicateErrors[a]["error"];
                            function searchItem(params) {
                                return params ? params.code === data[a]["code"] : null;
                            }
                            var item = items.find(searchItem);
                            if(!item){
                                if(Error === "")
                                    Error = Error + "Produk tidak ada di master";
                                else
                                    Error = Error + ", Produk tidak ada di master";
                            }
                        }
                        if(data[a]["qty"] !== ""){
                            if(isNaN(data[a]["qty"])){
                                if(Error === "")
                                    Error = Error + "Kuantitas harus numerik";
                                else
                                    Error = Error + ", Kuantitas harus numerik";
                            }
                        }
                        if(Error !== ""){
                            dataError.push({
                                "Barcode" : data[a]["code"],
                                "Nama Barang" : data[a]["name"],
                                "Kuantitas Stock" : data[a]["qty"],
                                "Deskripsi Error" : `Nomor Row ${(a + 2)}: ${Error}`
                            })
                        }
                    }
                    if(!valid.storageId || valid.storageId.toString() === "")
                        errors["storage"] = "storage harus diisi";
                    else if(!_storage)
                        errors["storage"] = "storage tidak ditemukan";
                    if(data.length === 0)
                        errors["file"] = "data CSV harus dipilih"
                    
                    for (var prop in errors) {
                        var ValidationError = require('module-toolkit').ValidationError;
                        reject(new ValidationError('data does not pass validation', errors));
                    }
                    if(dataError.length === 0){
                        var itemsData = [];
                        for(var a of data){
                            function searchItem(params) {
                                return params.code === a.code;
                            }
                            var item = items.find(searchItem);
                            var itemSO = new SODocItem({
                                itemId : (new ObjectId(item._id)),
                                item : item,
                                qtySO : Number(a.qty),
                                _createdDate : newDate,
                                _active : true
                            });
                            itemSO.stamp(this.user.username, 'manager');
                            itemsData.push(itemSO);
                        }
                        var SO = new SODoc({
                            code : generateCode(moduleId),
                            storageId : new ObjectId(_storage._id),
                            storage : _storage,
                            items : itemsData,
                            isProcess : false,
                            _createdDate : newDate,
                            _active : true
                        });
                        SO.stamp(this.user.username, 'manager');
                        this.collection.insert(SO)
                            .then(id => {
                                resolve(id);
                            })
                            .catch(e => {
                                reject(e);
                            });
                    }else{
                        resolve(dataError);
                    }
                })
                .catch(e => {
                    reject(e);
                });
        });
    }

    _validate(StockOpname){
        return new Promise((resolve, reject) => {
            var errors = {};
            var valid = StockOpname;
            var storageData = valid.storageId && ObjectId.isValid(valid.storageId) ? this.storageManager.getSingleByIdOrDefault(new ObjectId(valid.storageId)) : Promise.resolve(null);
            var dataItems = [];
            for(var a of valid.items){
                var item = a.itemId && ObjectId.isValid(a.itemId) ? this.itemManager.getSingleByIdOrDefault(new ObjectId(a.itemId)) : Promise.resolve(null);
                dataItems.push(item);
            }
            Promise.all([storageData].concat(dataItems))
                .then(results => {
                    var _storage = results[0];
                    var _dataItems = results.slice(1, results.length);
                    if(!valid.storageId || valid.storageId.toString() === "")
                        errors["storage"] = "storage harus diisi";
                    else if(!_storage)
                        errors["storage"] = "storage tidak ditemukan";
                    
                    var errorItems = [];
                    var idx = 0;
                    for(var a of valid.items){
                        var itemError = {};
                        function searchItem(params) {
                            return params.code === a.item.code;
                        }
                        var itemData = _dataItems.find(searchItem);
                        if(!a.itemId && a.itemId.toString() === "")
                            itemError["item"] = "item harus diisi";
                        if(!itemData)
                            itemError["item"] = "item tidak ditemukan";
                        
                        if(a.isAdjusted && (a.remark === "" || !a.remark))
                            itemError["remark"] = "catatan harus diisi";
                        
                        errorItems.push(itemError);
                        idx++;
                    }
                    for(var a of errorItems){
                        if (Object.getOwnPropertyNames(a).length > 0) {
                            errors["items"] = errorItems;
                            break;
                        }
                    }
                    
                    for (var prop in errors) {
                        var ValidationError = require('module-toolkit').ValidationError;
                        reject(new ValidationError('data does not pass validation', errors));
                    }

                    if(_storage){
                        valid.storageId = new ObjectId(_storage._id);
                        valid.storage = _storage;
                    }

                    var items = [];
                    for(var a of valid.items){
                        function searchItem(params) {
                            return params.code === a.item.code;
                        }
                        var itemData = _dataItems.find(searchItem);
                        a.itemId = new ObjectId(itemData._id);
                        a.item = itemData;
                        var SOItem = new SODocItem(a);
                        SOItem.stamp(this.user.username, 'manager');
                        items.push(SOItem);
                    }
                    valid.items = items;
                    valid.isProcessed = true;
                    valid = new SODoc(valid);
                    valid.stamp(this.user.username, 'manager');
                    resolve(valid);
                })
                .catch(e => {
                    reject(e);
                });
        });
    }

    _afterUpdate(id) {
        return new Promise((resolve, reject) => {
            this.collection.singleOrDefault({"_id" : new ObjectId(id)})
                .then(result => {
                    var dataIn= [];
                    var dataOut = [];
                    var newDate = new Date();
                    for(var a of result.items){
                        if(a.isAdjusted){
                            if(a.qtySO > a.qtyBeforeSO){
                                var inTransItem = new TransInItem({
                                    itemId : new ObjectId(a.itemId),
                                    item : a.item,
                                    quantity : a.qtySO - a.qtyBeforeSO,
                                    remark : a.remark,
                                    _createdDate : newDate,
                                    _active : true
                                });
                                inTransItem.stamp(this.user.username, 'manager');
                                dataIn.push(inTransItem);
                            }
                            if(a.qtySO < a.qtyBeforeSO){
                                var outTransItem = new TransOutItem({
                                    itemId : new ObjectId(a.itemId),
                                    item : a.item,
                                    quantity : a.qtyBeforeSO - a.qtySO,
                                    remark : a.remark,
                                    _createdDate : newDate,
                                    _active : true
                                });
                                outTransItem.stamp(this.user.username, 'manager');
                                dataOut.push(outTransItem);
                            }
                        }
                    }
                    if(dataIn.length > 0 || dataOut.length > 0){
                        var inDoc = new TransInDoc();
                        var outDoc = new TransOutDoc();
                        if(dataIn.length > 0){
                            inDoc.code = generateCode("EFR-TB/SO");
                            inDoc.source = result.storage;
                            inDoc.sourceId = new ObjectId(result.storageId);
                            inDoc.destination = result.storage;
                            inDoc.destinationId = new ObjectId(result.storageId);
                            inDoc.date = newDate;
                            inDoc.reference = result.code;
                            inDoc._createdDate = newDate;
                            inDoc.items = dataIn;
                            inDoc._active = true;
                            inDoc.stamp(this.user.username, 'manager');
                        }
                        if(dataOut.length > 0){
                            outDoc.code = generateCode("EFR-KB/SO");
                            outDoc.source = result.storage;
                            outDoc.sourceId = new ObjectId(result.storageId);
                            outDoc.destination = result.storage;
                            outDoc.destinationId = new ObjectId(result.storageId);
                            outDoc.date = newDate;
                            outDoc.reference = result.code;
                            outDoc._createdDate = newDate;
                            outDoc.items = dataOut;
                            outDoc._active = true;
                            outDoc.stamp(this.user.username, 'manager');
                        }
                        if(dataIn.length > 0 && dataOut.length <= 0){
                            this.transInManager.create(inDoc)
                                .then(idIn => {
                                    resolve(id);
                                })
                                .catch(e => {
                                    reject(e);
                                });
                        }else if(dataIn.length <= 0 && dataOut.length > 0){
                            this.transOutManager.create(outDoc)
                                .then(idOut => {
                                    resolve(id);
                                })
                                .catch(e => {
                                    reject(e);
                                });
                        }else{
                            this.transInManager.create(inDoc)
                                .then(idIn => {
                                    this.transOutManager.create(outDoc)
                                        .then(idOut => {
                                            resolve(id);
                                        })
                                        .catch(e => {
                                            reject(e);
                                        });
                                })
                                .catch(e => {
                                    reject(e);
                                });
                        }
                    }else
                        resolve(id);
                })
                .catch(e => {
                    reject(e);
                });
        });
    }

    getAllItemInInventoryBySOId(id){
        return new Promise((resolve, reject) => {
            this.collection.singleOrDefault({"_id" : new ObjectId(id)})
                .then(result => {
                    var dataInventory = [];
                    for (var a of result.items){
                        var query = this.inventoryManager.getByStorageIdAndItemIdOrDefault(result.storageId, a.itemId);
                        dataInventory.push(query);
                    }
                    Promise.all(dataInventory)
                        .then(inventories => {
                            resolve(inventories);
                        })
                        .catch(e => {
                            reject(e);
                        });
                })
                .catch(e => {
                    reject(e);
                });
        });
    }
};