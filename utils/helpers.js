module.exports = {
    sleep: delay => new Promise(resolve => setTimeout(resolve, delay)),
    filterObject: (obj, allowedFields) => {
        const newObj = {};
        Object.keys(obj).forEach(el => {
            if (allowedFields.includes(el)) newObj[el] = obj[el];
        });
        return newObj;
    },
    omitKeyValuePairs: (obj, fieldsToOmit) => {
        return fieldsToOmit.reduce(
            (acc, field) => {
                const newData = { ...acc };
                delete newData[field];
                return newData;
            },
            { ...obj },
        );
    },
    catchAsync: asyncFunction => {
        return (req, res, next) => {
            asyncFunction(req, res, next).catch(next);
        };
    },
};
