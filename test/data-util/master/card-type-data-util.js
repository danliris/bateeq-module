"use strict";
var _getSert = require("./getsert");
var generateCode = require("../../../src/utils/code-generator");

class CardTypeDataUtil {
    getSert(input) {
        var ManagerType = require("../../../src/managers/master/card-type-manager");
        return _getSert(input, ManagerType, (data) => {
            return {
                code: data.code
            };
        });
    }

    getNewData() {
        var CardType = require('bateeq-models').master.CardType;
        var cardType = new CardType();
        
        var now = new Date();
        var stamp = now / 1000 | 0;
        var code = generateCode();
        
        cardType.code = code;
        cardType.name = `name[${code}]`;
        cardType.description = `description for ${code}`;
        return Promise.resolve(cardType);
    }
}
module.exports = new CardTypeDataUtil();