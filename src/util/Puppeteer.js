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
    let state = exposedFunctions.get(page);
    if (!state) {
        state = {
            functions: new Map(),
            dispatcherBindingName: `__wwebjs_exposed_dispatcher_${++exposedFunctionId}`,
            dispatcherExposed: false,
        };
        exposedFunctions.set(page, state);
    }

    state.functions.set(name, fn);

    if (!state.dispatcherExposed) {
        try {
            await page.exposeFunction(
                state.dispatcherBindingName,
                (functionName, ...args) => {
                    const target = state.functions.get(functionName);
                    if (!target) {
                        throw new Error(
                            `No exposed WWebJS function registered for ${functionName}`,
                        );
                    }

                    return target(...args);
                },
            );
            state.dispatcherExposed = true;
        } catch (err) {
            state.functions.delete(name);
            throw err;
        }
    }

    try {
        await page.evaluate(
            ({ name, bindingName }) => {
                window[name] = (...args) => window[bindingName](name, ...args);
            },
            { name, bindingName: state.dispatcherBindingName },
        );
    } catch (err) {
        state.functions.delete(name);
        throw err;
    }
}

module.exports = { exposeFunctionIfAbsent };
