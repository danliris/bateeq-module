"use strict";
var _getsert = require("./getsert");
var generateCode = require("../../../src/utils/code-generator");

class PromoDataUtil {
    getSert(input) {
        var ManagerType = require("../../../src/managers/sales/promo-manager");
        return _getSert(input, ManagerType, (data) => {
            return {
                code: data.code
            };
        });
    };
    
    getNewDataDiscountItem() {
        var item1 = testData.finishedGoods["UT-FG1"];
        var item2 = testData.finishedGoods["UT-FG2"];
        var stores = [];
        stores.push(testData.stores["ST-FNG"]);
        stores.push(testData.stores["ST-BJB"]);
        stores.push(testData.stores["ST-BJR"]);

        var Promo = require('bateeq-models').sales.Promo;
        var PromoCriteria = require('bateeq-models').sales.PromoCriteria;
        var PromoReward = require('bateeq-models').sales.PromoReward;
        var PromoCriteriaSelectedProduct = require('bateeq-models').sales.PromoCriteriaSelectedProduct;
        var PromoRewardDiscountProduct = require('bateeq-models').sales.PromoRewardDiscountProduct;
    
        var promo = new Promo();
        var code = generateCode('UnitTest');

        promo.code = code;
        promo.name = 'Discount Item';
        promo.description = `description for ${code}`; 
        promo.validFrom = new Date("2000-01-01T00:00:00"); 
        promo.validTo = new Date("2000-12-01T00:00:00"); 
        promo.stores = stores;
        promo.criteria = {};
        promo.reward = {};
        
        var promoCriteria = new PromoCriteria();
        promoCriteria.type = 'selected-product';
        promoCriteria.criterions = [];
        
        var promoCriteriaSelectedProduct = new PromoCriteriaSelectedProduct();
        promoCriteriaSelectedProduct.itemId = item1._id;
        promoCriteriaSelectedProduct.item = item1;
        promoCriteriaSelectedProduct.minimumQuantity = 0;
        promoCriteria.criterions.push(promoCriteriaSelectedProduct);
        
        var promoCriteriaSelectedProduct = new PromoCriteriaSelectedProduct();
        promoCriteriaSelectedProduct.itemId = item2._id;
        promoCriteriaSelectedProduct.item = item2;
        promoCriteriaSelectedProduct.minimumQuantity = 0;
        promoCriteria.criterions.push(promoCriteriaSelectedProduct);
        
        var promoReward = new PromoReward();
        promoReward.type = 'discount-product';
        promoReward.rewards = [];
        
        var promoRewardDiscountProduct = new PromoRewardDiscountProduct();
        promoRewardDiscountProduct.unit = 'percentage';
        promoRewardDiscountProduct.discount1 = 10;
        promoRewardDiscountProduct.discount2 = 5;
        promoRewardDiscountProduct.nominal = 0;
        promoReward.rewards.push(promoRewardDiscountProduct);

        promo.criteria = promoCriteria;
        promo.reward = promoReward;
        return Promise.resolve(promo);
    };
    
    getNewDataPackageSpecialPrice() {
        var item1 = testData.finishedGoods["UT-FG1"];
        var item2 = testData.finishedGoods["UT-FG2"];
        var stores = [];
        stores.push(testData.stores["ST-FNG"]);
        stores.push(testData.stores["ST-BJB"]);
        stores.push(testData.stores["ST-BJR"]);

        var Promo = require('bateeq-models').sales.Promo;
        var PromoCriteria = require('bateeq-models').sales.PromoCriteria;
        var PromoReward = require('bateeq-models').sales.PromoReward;
        var PromoCriteriaPackage = require('bateeq-models').sales.PromoCriteriaPackage;
        var PromoRewardSpecialPrice = require('bateeq-models').sales.PromoRewardSpecialPrice;
        
        var promo = new Promo();
        var code = generateCode('UnitTest');

        promo.code = code;
        promo.name = 'Package Special Price';
        promo.description = `description for ${code}`; 
        promo.validFrom = new Date("2000-01-01T00:00:00"); 
        promo.validTo = new Date("2000-12-01T00:00:00"); 
        promo.stores = stores;
        promo.criteria = {};
        promo.reward = {};
        
        var promoCriteria = new PromoCriteria();
        promoCriteria.type = 'package';
        promoCriteria.criterions = [];
        
        var promoCriteriaPackage = new PromoCriteriaPackage();
        promoCriteriaPackage.itemId = item1._id;
        promoCriteriaPackage.item = item1;
        promoCriteria.criterions.push(promoCriteriaPackage);
        
        var promoCriteriaPackage = new PromoCriteriaPackage();
        promoCriteriaPackage.itemId = item2._id;
        promoCriteriaPackage.item = item2;
        promoCriteria.criterions.push(promoCriteriaPackage);
        
        var promoReward = new PromoReward();
        promoReward.type = 'special-price';
        promoReward.rewards = [];
        
        var promoRewardSpecialPrice = new PromoRewardSpecialPrice();
        promoRewardSpecialPrice.quantity1 = 100000;
        promoRewardSpecialPrice.quantity2 = 200000;
        promoRewardSpecialPrice.quantity3 = 300000;
        promoRewardSpecialPrice.quantity4 = 400000;
        promoRewardSpecialPrice.quantity5 = 500000;
        promoReward.rewards.push(promoRewardSpecialPrice);

        promo.criteria = promoCriteria;
        promo.reward = promoReward;
        return Promise.resolve(promo);
    };
}
module.exports = new PromoDataUtil();