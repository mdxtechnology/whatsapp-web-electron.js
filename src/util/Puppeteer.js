/**
 * Expose a function to the page if it does not exist
 *
 * NOTE:
 * Rewrite it to 'upsertFunction' after updating Puppeteer to 20.6 or higher
 * using page.removeExposedFunction
 * https://pptr.dev/api/puppeteer.page.removeexposedfunction
 *
 * @param {object} page - Puppeteer Page instance
 * @param {string} name
 * @param {Function} fn
 */
const exposedFunctions = new WeakMap();
let exposedFunctionId = 0;

async function exposeFunctionIfAbsent(page, name, fn) {
    let functions = exposedFunctions.get(page);
    if (!functions) {
        functions = new Map();
        exposedFunctions.set(page, functions);
    }

    const current = functions.get(name);
    if (current) {
        current.fn = fn;
        await page.evaluate(
            ({ name, bindingName }) => {
                window[name] = (...args) => window[bindingName](...args);
            },
            { name, bindingName: current.bindingName },
        );
        return;
    }

    const bindingName = `__wwebjs_exposed_${name}_${++exposedFunctionId}`;
    const entry = { fn, bindingName };
    functions.set(name, entry);

    try {
        await page.exposeFunction(bindingName, (...args) => entry.fn(...args));
    } catch (err) {
        functions.delete(name);
        throw err;
    }

    await page.evaluate(
        ({ name, bindingName }) => {
            window[name] = (...args) => window[bindingName](...args);
        },
        { name, bindingName },
    );
}

module.exports = { exposeFunctionIfAbsent };
