const PAGE_SIZE = 50;
const and = (...queries) => ({ $and:queries });
const converted = { $or:[{ status:'converted' },{ convertedTo:{ $ne:null } }] };
const notConverted = { $nor:converted.$or };
const activeFollowUp = and(notConverted,{ status:{ $ne:'closed' } });
const invalid = message => { throw Object.assign(new Error(message),{ statusCode:400 }); };
const option = (value, fallback, allowed, label) => {
  if (value === undefined || value === '') return fallback;
  if (typeof value !== 'string' || !allowed.includes(value)) invalid(`Choose a valid ${label}.`);
  return value;
};
function followUpQuery(filter,today) {
  if (filter === 'all') return {};
  const dates = {
    today:{ nextFollowUpDate:today },
    overdue:{ nextFollowUpDate:{ $lt:today,$nin:[null,''] } },
    due:{ nextFollowUpDate:{ $lte:today,$nin:[null,''] } },
    upcoming:{ nextFollowUpDate:{ $gt:today } },
    none:{ nextFollowUpDate:{ $in:[null,''] } },
  };
  return and(activeFollowUp,dates[filter]);
}
function listingQuery(params,scope,today) {
  const page = params.page === undefined ? 1 : Number(params.page);
  if (typeof params.page === 'object' || !Number.isSafeInteger(page) || page < 1) invalid('Page must be a whole number starting from 1.');
  const conversion = option(params.conversion,'all',['all','converted','not-converted'],'conversion filter');
  const followUp = option(params.followUp,'all',['all','due','today','overdue','upcoming','none'],'follow-up filter');
  const sort = option(params.sort,'latest',['latest','oldest','due','name-asc','name-desc','number-asc','number-desc'],'sort order');
  const status = option(params.status,'',['new','contacted','converted','closed'],'status');
  if (params.search !== undefined && (typeof params.search !== 'string' || params.search.length > 200)) invalid('Search must contain 200 characters or less.');
  const base = status ? and(scope,{ status }) : scope;
  const conditions = [base,followUpQuery(followUp,today)];
  if (conversion !== 'all') conditions.push(conversion === 'converted' ? converted : notConverted);
  const search = (params.search || '').trim();
  if (search) {
    const pattern = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i');
    conditions.push({ $or:['name','contact','phone','ivrsNo'].map(field => ({ [field]:pattern })) });
  }
  return { page,sort,base,query:and(...conditions) };
}
function sortedStages(sort) {
  if (sort === 'due') return [{ $addFields:{ __enquiryOrder:{ $cond:[{ $eq:[{ $ifNull:['$nextFollowUpDate',''] },''] },'9999-12-31','$nextFollowUpDate'] } } },{ $sort:{ __enquiryOrder:1,_id:1 } }];
  if (sort.startsWith('number-')) return [{ $addFields:{ __enquiryOrder:{ $cond:[{ $eq:[{ $ifNull:['$contact',''] },''] },{ $ifNull:['$phone',''] },'$contact'] } } },{ $sort:{ __enquiryOrder:sort === 'number-asc' ? 1 : -1,_id:1 } }];
  if (sort.startsWith('name-')) return [{ $sort:{ name:sort === 'name-asc' ? 1 : -1,_id:1 } }];
  const direction = sort === 'oldest' ? 1 : -1;
  return [{ $sort:{ createdAt:direction,_id:direction } }];
}
module.exports = { PAGE_SIZE,listingQuery,followUpQuery,sortedStages };
