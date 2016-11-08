'use strict';

// external deps 
var ObjectId = require('mongodb').ObjectId;

// internal deps
require('mongodb-toolkit');
var BaseManager = require('../base-manager');
var BateeqModels = require('bateeq-models');
var Promo = BateeqModels.sales.Promo;
var PromoCriteria = BateeqModels.sales.PromoCriteria;
var PromoReward = BateeqModels.sales.PromoReward;
var PromoCriteriaSelectedProduct = BateeqModels.sales.PromoCriteriaSelectedProduct;
var PromoRewardDiscountProduct = BateeqModels.sales.PromoRewardDiscountProduct;
var map = BateeqModels.map;
//var generateCode = require('../../utils/code-generator');
 
module.exports = class PromoManager extends BaseManager {
    constructor(db, user) {
        super(db, user);
        this.collection = this.db.use(map.sales.Promo);
        
        var StoreManager = require('../master/store-manager');
        this.storeManager = new StoreManager(db, user); 
        
        var ItemManager = require('../master/finished-goods-manager');
        this.itemManager = new ItemManager(db, user);
    }

    _createIndexes() {
        var dateIndex = {
            name: `ix_${map.sales.Promo}__updatedDate`,
            key: {
                _updatedDate: -1
            }
        }

        var codeIndex = {
            name: `ix_${map.sales.Promo}_code`,
            key: {
                code: 1
            },
            unique: true
        }

        return this.collection.createIndexes([dateIndex, codeIndex]);
    }
    
    _getQuery(paging) { 
        var deleted = {
            _deleted: false
        };
        
        var query = paging.filter ? {
            '$and': [paging.filter, deleted]
        } : deleted; 

        if (paging.keyword) {
            var regex = new RegExp(paging.keyword, "i");
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
        return query; 
    }
 
    _validate(promo) {
        var error = {};
        return new Promise((resolve, reject) => {
            var valid = new Promo(promo);
            var getPromo = this.collection.singleOrDefault({
                "$and": [{
                    _id: {
                        '$ne': new ObjectId(valid._id)
                    }
                }, {
                        code: valid.code
                    }]
            });
              
            Promise.all([getPromo])
                .then(resultPromos => {
                    var _promo = resultPromos[0];
                    
                    //validate header 
                    if (!valid.code || valid.code == '')
                        error["code"] = "code is required";
                    else if (_promo) {
                        error["code"] = "code already exists";
                    }
                    if (!valid.name || valid.name == '')
                        error["name"] = "name is required"; 
                    
                    if (Object.prototype.toString.call(valid.validFrom) === "[object Date]") {
                        if (isNaN( valid.validFrom.getTime())) {
                            error["validFrom"] = "validFrom is not valid";
                        }
                    }
                    else {
                        error["validFrom"] = "validFrom is not valid";
                    }
                        
                    if (Object.prototype.toString.call(valid.validTo) === "[object Date]") {
                        if (isNaN( valid.validTo.getTime())) {
                            error["validTo"] = "validTo is not valid";
                        } 
                    }
                    else {
                        error["validTo"] = "validTo is not valid"; 
                    }
                    
                    var getStores = [];
                    if (valid.stores && valid.stores.length > 0) {
                        for (var store of valid.stores) {  
                            getStores.push(this.storeManager.getSingleByIdOrDefault(store._id));
                        }
                    }
                    else {
                        error["stores"] = "stores is required";
                    } 
                    //end validate header 
                    
                    Promise.all(getStores)
                        .then(resultStores => {
                            var _stores = resultStores;
                            
                            //Stores Validation
                            var storeErrors = [];
                            for(var _store of _stores) {
                                var index = _stores.indexOf(_store);
                                var store = valid.stores[index];
                                var storeError = {};
                                if (!_store) {
                                    storeError["_id"] = "storeId not found";
                                }
                                else { 
                                    for (var i = valid.stores.indexOf(store) + 1; i < valid.stores.length; i++) {
                                        var otherStore = valid.stores[i];
                                        if (store._id == otherStore._id) {
                                            storeError["_id"] = "storeId already exists on another detail";
                                        }
                                    }
                                    store = _store;
                                }  
                                storeErrors.push(storeError);
                            }
                            
                            //Criteria Validation
                            var criteriaTypes = ["selected-product"];
                            var criteriaError = {};
                            var criteria = valid.criteria;
                            var getCriterions = [];
                            if (!criteria.type || criteria.type == '')
                                criteriaError["type"] = "type is required";
                            else {
                                if(criteriaTypes.indexOf(criteria.type) == -1)
                                    criteriaError["type"] = "type is not valid";
                                else {
                                    
                                    //selected-product validation
                                    if(criteria.type == criteriaTypes[0])
                                    {
                                        if (criteria.criterions && criteria.criterions.length > 0) {
                                            for (var criterion of criteria.criterions) {
                                                //get promise to check item
                                                getCriterions.push(this.itemManager.getSingleByIdOrDefault(criterion.itemId));
                                            }
                                        }
                                        else {
                                            criteriaError["criterions"] = "criterions is required";
                                        }
                                    } 
                                    
                                }
                            }  
                            
                            //Reward Validation
                            var rewardError = {};
                            var rewardTypes = ["discount-product"];
                            var rewardError = {};
                            var reward = valid.reward;
                            var getRewards = [];
                            if (!reward.type || reward.type == '')
                                rewardError["type"] = "type is required";
                            else {
                                if(rewardTypes.indexOf(reward.type) == -1)
                                    rewardError["type"] = "type is not valid";
                                else {
                                    
                                    //discount-product validation
                                    if(reward.type == rewardTypes[0])
                                    {
                                        if (reward.rewards && reward.rewards.length > 0) {}
                                        else
                                            rewardError["rewards"] = "rewards is required";
                                    } 
                                    
                                }
                            }
                            
                            var getCriterionsLength = getCriterions.length;
                            var getRewardsLength = getRewards.length;
                            Promise.all(getCriterions.concat(getRewards))
                                .then(results => {
                                    var _criterions = results.slice(0, getCriterionsLength);
                                    var _rewards = results.splice(getCriterionsLength, results.length);
                                    
                                    //selected-product validation
                                    if(criteria.type == criteriaTypes[0])
                                    {
                                        if (criteria.criterions && criteria.criterions.length > 0)
                                        {
                                            var criterionsErrors = [];
                                            for (var criterion of criteria.criterions) {
                                                var index = criteria.criterions.indexOf(criterion);
                                                var _criterion = _criterions[index];
                                                var criterionsError = {};
                                                criterion = new PromoCriteriaSelectedProduct(criterion);
                                                
                                                if (!criterion.itemId || criterion.itemId == '') {
                                                    criterionsError["itemId"] = "itemId is required";
                                                }
                                                else {
                                                    for (var i = index + 1; i < criteria.criterions.length; i++) {
                                                        var otherItem = criteria.criterions[i];
                                                        if (criterion.itemId == otherItem.itemId) {
                                                            criterionsError["itemId"] = "itemId already exists on another detail";
                                                        }
                                                    }
                                                }
                                                if (!_criterion) {
                                                    criterionsError["itemId"] = "itemId not found";
                                                }
                                                else {
                                                    criterion.itemId = _criterion._id;
                                                    criterion.item = _criterion;
                                                }
                                                if (criterion.minimumQuantity == undefined || (criterion.minimumQuantity && criterion.minimumQuantity == '')) {
                                                    criterionsError["minimumQuantity"] = "minimumQuantity is required";
                                                }
                                                else if (parseInt(criterion.minimumQuantity) < 0) {
                                                    criterionsError["minimumQuantity"] = "quantity must be greater than 0";
                                                }
                                                
                                                criterionsErrors.push(criterionsError);
                                            } 
                                            //assign criterions error
                                            for (var criterionsError of criterionsErrors) {
                                                for (var prop in criterionsError) {
                                                    criteriaError["criterions"] = criterionsErrors;
                                                    break;
                                                }
                                                if (criteriaError["criterions"])
                                                    break;
                                            } 
                                        }
                                    } 
                                     
                                    //discount-product validation
                                    if(reward.type == rewardTypes[0])
                                    {
                                        if (reward.rewards && reward.rewards.length > 0)
                                        {
                                            var rewardsErrors = [];
                                            for (var rewardloop of reward.rewards) 
                                            {
                                                rewardloop = new PromoRewardDiscountProduct(rewardloop);
                                                var rewardsError = {};
                                                var units = ["percentage", "nominal"];
                                                if (!rewardloop.unit || rewardloop.unit == '')
                                                    rewardsError["unit"] = "unit is required";
                                                else
                                                    if(units.indexOf(rewardloop.unit) == -1)
                                                        rewardsError["unit"] = "unit is not valid";
                                                    
                                                if (rewardloop.discount1 == undefined || (rewardloop.discount1 && rewardloop.discount1 == '')) 
                                                    rewardsError["discount1"] = "discount1 is required";
                                                else if (parseInt(rewardloop.discount1) < 0 || parseInt(rewardloop.discount1) > 100) 
                                                    rewardsError["discount1"] = "discount1 must be greater than 0 and less than 100";
                                                    
                                                if (rewardloop.discount2 == undefined || (rewardloop.discount2 && rewardloop.discount2 == '')) 
                                                    rewardsError["discount2"] = "discount2 is required";
                                                else if (parseInt(rewardloop.discount2) < 0 || parseInt(rewardloop.discount2) > 100) 
                                                    rewardsError["discount2"] = "discount2 must be greater than 0 and less than 100";
                                                 
                                                if (rewardloop.nominal == undefined || (rewardloop.nominal && rewardloop.nominal == '')) 
                                                    rewardsError["nominal"] = "nominal is required";
                                                else if (parseInt(rewardloop.nominal) < 0) 
                                                    rewardsError["nominal"] = "nominal must be greater than 0";
                                                
                                                rewardsErrors.push(rewardsError); 
                                            }
                                            //assign rewards error
                                            for (var rewardsError of rewardsErrors) {
                                                for (var prop in rewardsError) {
                                                    rewardError["rewards"] = rewardsErrors;
                                                    break;
                                                }
                                                if (rewardError["rewards"])
                                                    break;
                                            } 
                                        } 
                                    } 
                                    
                                    //assign Stores Error
                                    for (var storeError of storeErrors) {
                                        for (var prop in storeError) {
                                            error.stores = storeErrors;
                                            break;
                                        }
                                        if (error.stores)
                                            break;
                                    }
                                    //assign Criteria Error
                                    for (var prop in criteriaError) {
                                        error["criteria"] = criteriaError;
                                        break;
                                    }
                                    //assign Reward Error
                                    for (var prop in rewardError) {
                                        error["reward"] = rewardError;
                                        break;
                                    }
                                    //assign Error
                                    for (var prop in error) {
                                        var ValidationError = require('../../validation-error');
                                        reject(new ValidationError('data does not pass validation', error));
                                    } 
                                    
                                    valid = new Promo(valid);
                                    valid.stamp(this.user.username, 'manager');
                                    resolve(valid);  
                                })
                                .catch(e => {
                                    reject(e);
                                })  
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
};