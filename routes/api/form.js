var express = require('express');
var router = express.Router();

const baseApiUrl = 'https://api.fillout.com/v1/api';
const bearerToken = 'sk_prod_TfMbARhdgues5AuIosvvdAC9WsA5kXiZlW8HZPaRDlIbCpSpLsXBeZO7dCVZQwHAY3P4VSBPiiC33poZ1tdUj2ljOzdTCCOSpUZ_3912';

/* GET form */
router.get('/:formId/filteredResponses', function(req, res, next) {
    // TODO: Consider validation here, based on requirements and more context...
    // Before passing on to API (better performance, but... validation at API could change invalidating our validation here potentially, etc)
    const formId = req.params.formId;
    const limit = req.query.limit;
    const afterDate = req.query.afterDate;
    const beforeDate = req.query.beforeDate;
    const offset = req.query.offset;
    const status = req.query.status;
    const includeEditLink = req.query.includeEditLink;
    const sort = req.query.sort;
    let filters = req.query.filters || '';
    const validConditions = ['equals', 'does_not_equal', 'greater_than', 'less_than'];
    let resultsFilterFunction = undefined;

    try {
        // TODO: Consider switching app to TypeScript to simplify things here...
        if (filters.length > 0) {
            filters = decodeURIComponent(filters);
            filters = JSON.parse(filters);

            // Validate our filters parameter, can probably clean this up a bit more later...
            for (let x of filters) {
                if (x.id === undefined) {
                    res.status(400).send({
                        error: `Invalid filters parameter, id property required for each filter condition`
                    });
                    return;
                }
                if (x.condition === undefined || !validConditions.includes(x.condition.toLowerCase())) {
                    res.status(400).send({
                        error: `Invalid filters parameter, bad condition: ${x.condition}! (allowed conditions: ${JSON.stringify(validConditions)})`
                    });
                    return;
                }
                if (x.value === undefined) {
                    res.status(400).send({
                        error: `Invalid filters parameter, value property required for each filter condition`
                    });
                    return;
                }
            }

            // Apply each of our filters in our filter parameter array to this particular response object item, from the API's response array
            resultsFilterFunction = (responseObj) => {
                let isMatch = true;

                // console.log(`responseObj.questions: ${JSON.stringify(responseObj.questions)}`);

                for (let x of filters) {
                    switch (x.condition.toLowerCase()) {
                        case 'equals':
                            isMatch = responseObj.questions.filter(y => 
                                y.id?.toLowerCase() === x.id.toLowerCase() 
                                && y.value?.toLowerCase() === x.value.toLowerCase()).length > 0;
                            break;
                        case 'does_not_equal':
                            isMatch = responseObj.questions.filter(y => 
                                y.id?.toLowerCase() === x.id.toLowerCase() 
                                && y.value?.toLowerCase() !== x.value.toLowerCase()).length > 0;
                            break;
                        // TODO: More testing for dates, think we might be okay not converting and considering question type DatePicker here...?
                        case 'greater_than':
                            isMatch = responseObj.questions.filter(y => 
                                y.id?.toLowerCase() === x.id.toLowerCase() 
                                && y.value?.toLowerCase() > x.value.toLowerCase()).length > 0;
                            break;
                        // TODO: More testing for dates, think we might be okay not converting and considering question type DatePicker here...?
                        case 'less_than':
                            isMatch = responseObj.questions.filter(y => 
                                y.id?.toLowerCase() === x.id.toLowerCase() 
                                && y.value?.toLowerCase() < x.value.toLowerCase()).length > 0;
                            break;
                    }
                        
                    if (!isMatch)
                    {
                        break;
                    }
                }

                return isMatch;
            };
        }
    } catch (err) {
        // TODO: May not want to reveal details about errors... (maybe use error codes)
        res.status(400).send({
            error: `Invalid filters parameter: ${err}`
        });
        
        return;
    }

    (async (resObj) => {
        try {
            let requestUrl = `${baseApiUrl}/forms/${formId}/submissions`;

            requestUrl += '?';
            requestUrl += afterDate ? `&afterDate=${afterDate}` : '';
            requestUrl += beforeDate ? `&beforeDate=${beforeDate}` : '';
            requestUrl += status ? `&status=${status}` : '';
            requestUrl += includeEditLink ? `&includeEditLink=${includeEditLink}` : '';
            requestUrl += sort ? `&sort=${sort}` : '';

            console.log(`requestUrl: ${requestUrl}`);

            const res = await fetch(
                requestUrl,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${bearerToken}`,
                    },
                }
            );
            
            console.log(`status: ${res.status}`);
            console.log(`statusText: ${res.statusText}`);
            
            let responseData = await res.json();

            if (resultsFilterFunction !== undefined) {
                responseData.responses = responseData.responses.filter(x => resultsFilterFunction(x));
            
                responseData.totalResponses = responseData.responses.length;

                // TODO: More validation later, now that we are using this here in our proxy, instead of passing on to API
                if (offset !== undefined) {
                    responseData.responses = responseData.responses.slice(offset);
                }

                // TODO: More validation later, now that we are using this here in our proxy, instead of passing on to API
                if (limit !== undefined) {
                    responseData.responses = responseData.responses.slice(0, limit);

                    responseData.pageCount = Math.ceil(responseData.totalResponses / limit);
                }
            }

            resObj.status(200).send(responseData);
        } catch (err) {
            res.status(400).send({
                error: `Error retrieving response data from API: ${err}`
            });
        }
    })(res);
});

module.exports = router;
