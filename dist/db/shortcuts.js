"use strict";
/*
Zapatos: https://jawj.github.io/zapatos/
Copyright (C) 2020 - 2022 George MacKerron
Released under the MIT licence: see LICENCE file
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.max = exports.min = exports.avg = exports.sum = exports.count = exports.selectExactlyOne = exports.selectOne = exports.select = exports.NotExactlyOneError = exports.SelectResultMode = exports.truncate = exports.deletes = exports.update = exports.upsert = exports.doNothing = exports.constraint = exports.Constraint = exports.insert = void 0;
const core_1 = require("./core");
const utils_1 = require("./utils");
;
function SQLForColumnsOfTable(columns, table) {
    return columns === undefined ? (0, core_1.sql) `to_jsonb(${table}.*)` :
        (0, core_1.sql) `jsonb_build_object(${(0, utils_1.mapWithSeparator)(columns, (0, core_1.sql) `, `, c => (0, core_1.sql) `${(0, core_1.param)(c)}::text, ${c}`)})`;
}
function SQLForExtras(extras) {
    return extras === undefined ? [] :
        (0, core_1.sql) ` || jsonb_build_object(${(0, utils_1.mapWithSeparator)(Object.keys(extras), (0, core_1.sql) `, `, k => (0, core_1.sql) `${(0, core_1.param)(k)}::text, ${extras[k]}`)})`;
}
/**
 * Generate an `INSERT` query `SQLFragment`.
 * @param table The table into which to insert
 * @param values The `Insertable` values (or array thereof) to be inserted
 */
const insert = function (table, values, options) {
    let query;
    if (Array.isArray(values) && values.length === 0) {
        query = (0, core_1.sql) `INSERT INTO ${table} SELECT null WHERE false`;
        query.noop = true;
        query.noopResult = [];
    }
    else {
        const completedValues = Array.isArray(values) ? (0, utils_1.completeKeysWithDefaultValue)(values, core_1.Default) : values, colsSQL = (0, core_1.cols)(Array.isArray(completedValues) ? completedValues[0] : completedValues), valuesSQL = Array.isArray(completedValues) ?
            (0, utils_1.mapWithSeparator)(completedValues, (0, core_1.sql) `, `, v => (0, core_1.sql) `(${(0, core_1.vals)(v)})`) :
            (0, core_1.sql) `(${(0, core_1.vals)(completedValues)})`, returningSQL = SQLForColumnsOfTable(options === null || options === void 0 ? void 0 : options.returning, table), extrasSQL = SQLForExtras(options === null || options === void 0 ? void 0 : options.extras);
        query = (0, core_1.sql) `INSERT INTO ${table} (${colsSQL}) VALUES ${valuesSQL} RETURNING ${returningSQL}${extrasSQL} AS result`;
    }
    query.runResultTransform = Array.isArray(values) ?
        (qr) => qr.rows.map(r => r.result) :
        (qr) => qr.rows[0].result;
    return query;
};
exports.insert = insert;
/* === upsert === */
/**
 * Wraps a unique index of the target table for use as the arbiter constraint
 * of an `upsert` shortcut query.
 */
class Constraint {
    constructor(value) {
        this.value = value;
    }
}
exports.Constraint = Constraint;
/**
 * Returns a `Constraint` instance, wrapping a unique index of the target table
 * for use as the arbiter constraint of an `upsert` shortcut query.
 */
function constraint(x) { return new Constraint(x); }
exports.constraint = constraint;
exports.doNothing = [];
/**
 * Generate an 'upsert' (`INSERT ... ON CONFLICT ...`) query `SQLFragment`.
 * @param table The table to update or insert into
 * @param values An `Insertable` of values (or an array thereof) to be inserted
 * or updated
 * @param conflictTarget A `UNIQUE`-indexed column (or array thereof) or a
 * `UNIQUE` index (wrapped in `db.constraint(...)`) that determines whether we
 * get an `UPDATE` (when there's a matching existing value) or an `INSERT`
 * (when there isn't)
 * @param options Optionally, an object with any of the keys `updateColumns`,
 * `noNullUpdateColumns` and `updateValues` (see documentation).
 */
const upsert = function (table, values, conflictTarget, options) {
    var _a, _b, _c;
    if (Array.isArray(values) && values.length === 0)
        return (0, exports.insert)(table, values); // punt a no-op to plain insert
    if (typeof conflictTarget === 'string')
        conflictTarget = [conflictTarget]; // now either Column[] or Constraint
    let noNullUpdateColumns = (_a = options === null || options === void 0 ? void 0 : options.noNullUpdateColumns) !== null && _a !== void 0 ? _a : [];
    if (!Array.isArray(noNullUpdateColumns))
        noNullUpdateColumns = [noNullUpdateColumns];
    let specifiedUpdateColumns = options === null || options === void 0 ? void 0 : options.updateColumns;
    if (specifiedUpdateColumns && !Array.isArray(specifiedUpdateColumns))
        specifiedUpdateColumns = [specifiedUpdateColumns];
    const completedValues = Array.isArray(values) ? (0, utils_1.completeKeysWithDefaultValue)(values, core_1.Default) : [values], firstRow = completedValues[0], insertColsSQL = (0, core_1.cols)(firstRow), insertValuesSQL = (0, utils_1.mapWithSeparator)(completedValues, (0, core_1.sql) `, `, v => (0, core_1.sql) `(${(0, core_1.vals)(v)})`), colNames = Object.keys(firstRow), updateValues = (_b = options === null || options === void 0 ? void 0 : options.updateValues) !== null && _b !== void 0 ? _b : {}, updateColumns = [...new Set(// deduplicate the keys here
        [...(_c = specifiedUpdateColumns) !== null && _c !== void 0 ? _c : colNames, ...Object.keys(updateValues)])], conflictTargetSQL = Array.isArray(conflictTarget) ?
        (0, core_1.sql) `(${(0, utils_1.mapWithSeparator)(conflictTarget, (0, core_1.sql) `, `, c => c)})` :
        (0, core_1.sql) `ON CONSTRAINT ${conflictTarget.value}`, updateColsSQL = (0, utils_1.mapWithSeparator)(updateColumns, (0, core_1.sql) `, `, c => c), updateValuesSQL = (0, utils_1.mapWithSeparator)(updateColumns, (0, core_1.sql) `, `, c => updateValues[c] !== undefined ? updateValues[c] :
        noNullUpdateColumns.includes(c) ? (0, core_1.sql) `CASE WHEN EXCLUDED.${c} IS NULL THEN ${table}.${c} ELSE EXCLUDED.${c} END` :
            (0, core_1.sql) `EXCLUDED.${c}`), returningSQL = SQLForColumnsOfTable(options === null || options === void 0 ? void 0 : options.returning, table), extrasSQL = SQLForExtras(options === null || options === void 0 ? void 0 : options.extras), suppressReport = (options === null || options === void 0 ? void 0 : options.reportAction) === 'suppress';
    // the added-on $action = 'INSERT' | 'UPDATE' key takes after SQL Server's approach to MERGE
    // (and on the use of xmax for this purpose, see: https://stackoverflow.com/questions/39058213/postgresql-upsert-differentiate-inserted-and-updated-rows-using-system-columns-x)
    const insertPart = (0, core_1.sql) `INSERT INTO ${table} (${insertColsSQL}) VALUES ${insertValuesSQL}`, conflictPart = (0, core_1.sql) `ON CONFLICT ${conflictTargetSQL} DO`, conflictActionPart = updateColsSQL.length > 0 ? (0, core_1.sql) `UPDATE SET (${updateColsSQL}) = ROW(${updateValuesSQL})` : (0, core_1.sql) `NOTHING`, reportPart = (0, core_1.sql) ` || jsonb_build_object('$action', CASE xmax WHEN 0 THEN 'INSERT' ELSE 'UPDATE' END)`, returningPart = (0, core_1.sql) `RETURNING ${returningSQL}${extrasSQL}${suppressReport ? [] : reportPart} AS result`, query = (0, core_1.sql) `${insertPart} ${conflictPart} ${conflictActionPart} ${returningPart}`;
    query.runResultTransform = Array.isArray(values) ?
        (qr) => qr.rows.map(r => r.result) :
        (qr) => { var _a; return (_a = qr.rows[0]) === null || _a === void 0 ? void 0 : _a.result; };
    return query;
};
exports.upsert = upsert;
/**
 * Generate an `UPDATE` query `SQLFragment`.
 * @param table The table to update
 * @param values An `Updatable` of the new values with which to update the table
 * @param where A `Whereable` (or `SQLFragment`) defining which rows to update
 */
const update = function (table, values, where, options) {
    // note: the ROW() constructor below is required in Postgres 10+ if we're updating a single column
    // more info: https://www.postgresql-archive.org/Possible-regression-in-UPDATE-SET-lt-column-list-gt-lt-row-expression-gt-with-just-one-single-column0-td5989074.html
    const returningSQL = SQLForColumnsOfTable(options === null || options === void 0 ? void 0 : options.returning, table), extrasSQL = SQLForExtras(options === null || options === void 0 ? void 0 : options.extras), query = (0, core_1.sql) `UPDATE ${table} SET (${(0, core_1.cols)(values)}) = ROW(${(0, core_1.vals)(values)}) WHERE ${where} RETURNING ${returningSQL}${extrasSQL} AS result`;
    query.runResultTransform = (qr) => qr.rows.map(r => r.result);
    return query;
};
exports.update = update;
/**
 * Generate an `DELETE` query `SQLFragment` (plain 'delete' is a reserved word)
 * @param table The table to delete from
 * @param where A `Whereable` (or `SQLFragment`) defining which rows to delete
 */
const deletes = function (table, where, options) {
    const returningSQL = SQLForColumnsOfTable(options === null || options === void 0 ? void 0 : options.returning, table), extrasSQL = SQLForExtras(options === null || options === void 0 ? void 0 : options.extras), query = (0, core_1.sql) `DELETE FROM ${table} WHERE ${where} RETURNING ${returningSQL}${extrasSQL} AS result`;
    query.runResultTransform = (qr) => qr.rows.map(r => r.result);
    return query;
};
exports.deletes = deletes;
/**
 * Generate a `TRUNCATE` query `SQLFragment`.
 * @param table The table (or array thereof) to truncate
 * @param opts Options: 'CONTINUE IDENTITY'/'RESTART IDENTITY' and/or
 * 'RESTRICT'/'CASCADE'
 */
const truncate = function (table, ...opts) {
    if (!Array.isArray(table))
        table = [table];
    const tables = (0, utils_1.mapWithSeparator)(table, (0, core_1.sql) `, `, t => t), query = (0, core_1.sql) `TRUNCATE ${tables}${(0, core_1.raw)((opts.length ? ' ' : '') + opts.join(' '))}`;
    return query;
};
exports.truncate = truncate;
;
var SelectResultMode;
(function (SelectResultMode) {
    SelectResultMode[SelectResultMode["Many"] = 0] = "Many";
    SelectResultMode[SelectResultMode["One"] = 1] = "One";
    SelectResultMode[SelectResultMode["ExactlyOne"] = 2] = "ExactlyOne";
    SelectResultMode[SelectResultMode["Numeric"] = 3] = "Numeric";
})(SelectResultMode = exports.SelectResultMode || (exports.SelectResultMode = {}));
class NotExactlyOneError extends Error {
    constructor(query, ...params) {
        super(...params);
        if (Error.captureStackTrace)
            Error.captureStackTrace(this, NotExactlyOneError); // V8 only
        this.name = 'NotExactlyOneError';
        this.query = query; // custom property
    }
}
exports.NotExactlyOneError = NotExactlyOneError;
/**
 * Generate a `SELECT` query `SQLFragment`. This can be nested with other
 * `select`/`selectOne`/`count` queries using the `lateral` option.
 * @param table The table to select from
 * @param where A `Whereable` or `SQLFragment` defining the rows to be selected,
 * or `all`
 * @param options Options object. Keys (all optional) are:
 * * `columns` — an array of column names: only these columns will be returned
 * * `order` – an array of `OrderSpec` objects, such as
 * `{ by: 'column', direction: 'ASC' }`
 * * `limit` and `offset` – numbers: apply this limit and offset to the query
 * * `lateral` — either an object mapping keys to nested `select`/`selectOne`/
 * `count` queries to be `LATERAL JOIN`ed, or a single `select`/`selectOne`/
 * `count` query whose result will be passed through directly as the result of
 * the containing query
 * * `alias` — table alias (string): required if using `lateral` to join a table
 * to itself
 * * `extras` — an object mapping key(s) to `SQLFragment`s, so that derived
 * quantities can be included in the JSON result
 * @param mode (Used internally by `selectOne` and `count`)
 */
const select = function (table, where = core_1.all, options = {}, mode = SelectResultMode.Many, aggregate = 'count') {
    const limit1 = mode === SelectResultMode.One || mode === SelectResultMode.ExactlyOne, allOptions = limit1 ? { ...options, limit: 1 } : options, alias = allOptions.alias || table, { distinct, groupBy, having, lateral, columns, extras } = allOptions, lock = allOptions.lock === undefined || Array.isArray(allOptions.lock) ? allOptions.lock : [allOptions.lock], order = allOptions.order === undefined || Array.isArray(allOptions.order) ? allOptions.order : [allOptions.order], tableAliasSQL = alias === table ? [] : (0, core_1.sql) ` AS ${alias}`, distinctSQL = !distinct ? [] : (0, core_1.sql) ` DISTINCT${distinct instanceof core_1.SQLFragment || typeof distinct === 'string' ? (0, core_1.sql) ` ON (${distinct})` :
        Array.isArray(distinct) ? (0, core_1.sql) ` ON (${(0, core_1.cols)(distinct)})` : []}`, colsSQL = lateral instanceof core_1.SQLFragment ? [] :
        mode === SelectResultMode.Numeric ?
            (columns ? (0, core_1.sql) `${(0, core_1.raw)(aggregate)}(${(0, core_1.cols)(columns)})` : (0, core_1.sql) `${(0, core_1.raw)(aggregate)}(${alias}.*)`) :
            SQLForColumnsOfTable(columns, alias), colsExtraSQL = lateral instanceof core_1.SQLFragment || mode === SelectResultMode.Numeric ? [] : SQLForExtras(extras), colsLateralSQL = lateral === undefined || mode === SelectResultMode.Numeric ? [] :
        lateral instanceof core_1.SQLFragment ? (0, core_1.sql) `"lateral_passthru".result` :
            (0, core_1.sql) ` || jsonb_build_object(${(0, utils_1.mapWithSeparator)(Object.keys(lateral).sort(), (0, core_1.sql) `, `, k => (0, core_1.sql) `${(0, core_1.param)(k)}::text, "lateral_${(0, core_1.raw)(k)}".result`)})`, allColsSQL = (0, core_1.sql) `${colsSQL}${colsExtraSQL}${colsLateralSQL}`, whereSQL = where === core_1.all ? [] : (0, core_1.sql) ` WHERE ${where}`, groupBySQL = !groupBy ? [] : (0, core_1.sql) ` GROUP BY ${groupBy instanceof core_1.SQLFragment || typeof groupBy === 'string' ? groupBy : (0, core_1.cols)(groupBy)}`, havingSQL = !having ? [] : (0, core_1.sql) ` HAVING ${having}`, orderSQL = order === undefined ? [] :
        (0, core_1.sql) ` ORDER BY ${(0, utils_1.mapWithSeparator)(order, (0, core_1.sql) `, `, o => {
            if (!['ASC', 'DESC'].includes(o.direction))
                throw new Error(`Direction must be ASC/DESC, not '${o.direction}'`);
            if (o.nulls && !['FIRST', 'LAST'].includes(o.nulls))
                throw new Error(`Nulls must be FIRST/LAST/undefined, not '${o.nulls}'`);
            return (0, core_1.sql) `${o.by} ${(0, core_1.raw)(o.direction)}${o.nulls ? (0, core_1.sql) ` NULLS ${(0, core_1.raw)(o.nulls)}` : []}`;
        })}`, limitSQL = allOptions.limit === undefined ? [] :
        allOptions.withTies ? (0, core_1.sql) ` FETCH FIRST ${(0, core_1.param)(allOptions.limit)} ROWS WITH TIES` :
            (0, core_1.sql) ` LIMIT ${(0, core_1.param)(allOptions.limit)}`, // compatibility with pg pre-10.5; and fewer bytes!
    offsetSQL = allOptions.offset === undefined ? [] : (0, core_1.sql) ` OFFSET ${(0, core_1.param)(allOptions.offset)}`, // pg is lax about OFFSET following FETCH, and we exploit that
    lockSQL = lock === undefined ? [] : lock.map(lock => {
        const ofTables = lock.of === undefined || Array.isArray(lock.of) ? lock.of : [lock.of], ofClause = ofTables === undefined ? [] : (0, core_1.sql) ` OF ${(0, utils_1.mapWithSeparator)(ofTables, (0, core_1.sql) `, `, t => t)}`; // `as` clause is required when TS not strict
        return (0, core_1.sql) ` FOR ${(0, core_1.raw)(lock.for)}${ofClause}${lock.wait ? (0, core_1.sql) ` ${(0, core_1.raw)(lock.wait)}` : []}`;
    }), lateralSQL = lateral === undefined ? [] :
        lateral instanceof core_1.SQLFragment ? (() => {
            lateral.parentTable = alias;
            return (0, core_1.sql) ` LEFT JOIN LATERAL (${lateral}) AS "lateral_passthru" ON true`;
        })() :
            Object.keys(lateral).sort().map(k => {
                const subQ = lateral[k];
                subQ.parentTable = alias; // enables `parent('column')` in subquery's Whereables
                return (0, core_1.sql) ` LEFT JOIN LATERAL (${subQ}) AS "lateral_${(0, core_1.raw)(k)}" ON true`;
            });
    const rowsQuery = (0, core_1.sql) `SELECT${distinctSQL} ${allColsSQL} AS result FROM ${table}${tableAliasSQL}${lateralSQL}${whereSQL}${groupBySQL}${havingSQL}${orderSQL}${limitSQL}${offsetSQL}${lockSQL}`, query = mode !== SelectResultMode.Many ? rowsQuery :
        // we need the aggregate to sit in a sub-SELECT in order to keep ORDER and LIMIT working as usual
        (0, core_1.sql) `SELECT coalesce(jsonb_agg(result), '[]') AS result FROM (${rowsQuery}) AS ${(0, core_1.raw)(`"sq_${alias}"`)}`;
    query.runResultTransform =
        mode === SelectResultMode.Numeric ?
            // note: pg deliberately returns strings for int8 in case 64-bit numbers overflow
            // (see https://github.com/brianc/node-pg-types#use), but we assume our counts aren't that big
            (qr) => Number(qr.rows[0].result) :
            mode === SelectResultMode.ExactlyOne ?
                (qr) => {
                    var _a;
                    const result = (_a = qr.rows[0]) === null || _a === void 0 ? void 0 : _a.result;
                    if (result === undefined)
                        throw new NotExactlyOneError(query, 'One result expected but none returned (hint: check `.query.compile()` on this Error)');
                    return result;
                } :
                // SelectResultMode.One or SelectResultMode.Many
                (qr) => { var _a; return (_a = qr.rows[0]) === null || _a === void 0 ? void 0 : _a.result; };
    return query;
};
exports.select = select;
/**
 * Generate a `SELECT` query `SQLFragment` that returns only a single result (or
 * undefined). A `LIMIT 1` clause is added automatically. This can be nested with
 * other `select`/`selectOne`/`count` queries using the `lateral` option.
 * @param table The table to select from
 * @param where A `Whereable` or `SQLFragment` defining the rows to be selected,
 * or `all`
 * @param options Options object. See documentation for `select` for details.
 */
const selectOne = function (table, where, options = {}) {
    // you might argue that 'selectOne' offers little that you can't get with 
    // destructuring assignment and plain 'select' 
    // -- e.g.let[x] = async select(...).run(pool); -- but something worth having
    // is '| undefined' in the return signature, because the result of indexing 
    // never includes undefined (until 4.1 and --noUncheckedIndexedAccess)
    // (see https://github.com/Microsoft/TypeScript/issues/13778)
    return (0, exports.select)(table, where, options, SelectResultMode.One);
};
exports.selectOne = selectOne;
/**
 * Generate a `SELECT` query `SQLFragment` that returns a single result or
 * throws an error. A `LIMIT 1` clause is added automatically. This can be
 * nested with other `select`/`selectOne`/`count` queries using the `lateral`
 * option.
 * @param table The table to select from
 * @param where A `Whereable` or `SQLFragment` defining the rows to be selected,
 * or `all`
 * @param options Options object. See documentation for `select` for details.
 */
const selectExactlyOne = function (table, where, options = {}) {
    return (0, exports.select)(table, where, options, SelectResultMode.ExactlyOne);
};
exports.selectExactlyOne = selectExactlyOne;
/**
 * Generate a `SELECT` query `SQLFragment` that returns a count. This can be
 * nested in other `select`/`selectOne` queries using their `lateral` option.
 * @param table The table to count from
 * @param where A `Whereable` or `SQLFragment` defining the rows to be counted,
 * or `all`
 * @param options Options object. Useful keys may be: `columns`, `alias`.
 */
const count = function (table, where, options) {
    return (0, exports.select)(table, where, options, SelectResultMode.Numeric);
};
exports.count = count;
/**
 * Generate a `SELECT` query `SQLFragment` that returns a sum. This can be
 * nested in other `select`/`selectOne` queries using their `lateral` option.
 * @param table The table to aggregate from
 * @param where A `Whereable` or `SQLFragment` defining the rows to be
 * aggregated, or `all`
 * @param options Options object. Useful keys may be: `columns`, `alias`.
 */
const sum = function (table, where, options) {
    return (0, exports.select)(table, where, options, SelectResultMode.Numeric, 'sum');
};
exports.sum = sum;
/**
 * Generate a `SELECT` query `SQLFragment` that returns an arithmetic mean via
 * the `avg` aggregate function. This can be nested in other `select`/
 * `selectOne` queries using their `lateral` option.
 * @param table The table to aggregate from
 * @param where A `Whereable` or `SQLFragment` defining the rows to be
 * aggregated, or `all`
 * @param options Options object. Useful keys may be: `columns`, `alias`.
 */
const avg = function (table, where, options) {
    return (0, exports.select)(table, where, options, SelectResultMode.Numeric, 'avg');
};
exports.avg = avg;
/**
 * Generate a `SELECT` query `SQLFragment` that returns a minimum via the `min`
 * aggregate function. This can be nested in other `select`/`selectOne` queries
 * using their `lateral` option.
 * @param table The table to aggregate from
 * @param where A `Whereable` or `SQLFragment` defining the rows to be
 * aggregated, or `all`
 * @param options Options object. Useful keys may be: `columns`, `alias`.
 */
const min = function (table, where, options) {
    return (0, exports.select)(table, where, options, SelectResultMode.Numeric, 'min');
};
exports.min = min;
/**
 * Generate a `SELECT` query `SQLFragment` that returns a maximum via the `max`
 * aggregate function. This can be nested in other `select`/`selectOne` queries
 * using their `lateral` option.
 * @param table The table to aggregate from
 * @param where A `Whereable` or `SQLFragment` defining the rows to be
 * aggregated, or `all`
 * @param options Options object. Useful keys may be: `columns`, `alias`.
 */
const max = function (table, where, options) {
    return (0, exports.select)(table, where, options, SelectResultMode.Numeric, 'max');
};
exports.max = max;
