
/**
 * mixin装饰器，专用于class/constructor
 * @param  {Object|Array<Object>} mixins mixin构造函数的prototype
 * @param  {Object|Array<Object>} staticMixins mixin构造函数的静态方法或属性
 * @return {Function} 返回一个decorator
 */
export function mixin(mixins, staticMixins){
    return (...args) => {
        let fn = args[0];
        
        if(args.length === 1 && typeof fn === 'function'){
            if(!Array.isArray(mixins)){
                mixins = [mixins];
            }

            if(!Array.isArray(staticMixins)){
                staticMixins = [staticMixins];
            }

            mixins.forEach((mixin) => {
                Object.assign(fn.prototype, mixin);
            });

            staticMixins.forEach((staticMixin) => {
                Object.assign(fn, staticMixin);
            });

        } else {
            throw new Error('Leading decorators must be attached to a class declaration');
        }
    }
}
