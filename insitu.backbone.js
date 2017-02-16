_.extend(Backbone.Model.prototype, {

    hasTemporaryId: function() {
        return smartyApp.Validation.isTemporaryId(this.id);
    },

    reset: function(attrs, options) {
        if (!attrs) {
            attrs = this.defaults;
        }

        for (var key in this.attributes) {
            if (key in attrs) continue;
            attrs[key] = void 0;
        }

        return this.set(attrs, options);
    },

    matches: function(attrs) {
        for (var key in attrs) {
            var this_value = this.get(key);
            var required_value = attrs[key];

            if (

                // model.value == check.value
                required_value !== this_value

                // model.value IN [check.values]
                && !(
                    _.isArray(required_value)
                    && _.contains(required_value, this_value)
                )

                // [model.values] contain check.value
                // && !(
                //     _.isArray(this_value)
                //     && _.contains(this_value, required_value)
                // )
            ) {
                return false;
            }
        }

        return true;
    },


    customDestroy: function(options){
        $.ajax({
            method: "DELETE",
            url: this.url,
            context: this,
            data: {
                id: this.id
            }
        });

        this.trigger('destroy', this, this.collection, options);
    },

    /*
    	to be used within validate()

    	attrs: attribute hash passed to validate
    	validationObject: {attribute-key: validationResultOrFunction}

    	produces array with erroneous keys as validationError
     */
    validateByKey: function(attrs, validationObject) {
		var erroneous_keys = [];
    	_.each(validationObject, function(evaluate, key) {
    		if (_.isFunction(evaluate)) { evaluate = evaluate(attrs); }
    		if (!evaluate) { erroneous_keys.push(key); }
    	});
    	return erroneous_keys.length > 0 ? erroneous_keys : undefined;
    },
});




_.extend(Backbone.Collection.prototype, {

    // sortType: 'natural',

    reverse: function(){
        this.models = this.models.reverse();
        return this;
    },

    pluckUnique: function(attr) {
        return _.unique(this.pluck(attr));
    },

    // accepts parameter array
    multiPluck: function(attrs) {
        return this.invoke("pick",attrs);
    },

    multipluckUnique: function(attrs) {
        var sets = this.multiPluck(attrs);
        return _.unique(sets, function(model) {
            return JSON.stringify(model); // use JSON.stringify as object hash
        });
    },

    generateTempId: function(){
        return _.uniqueId("t");
    },

    // overwrite .where() to behave like Backbone < 1.2.0 : operate on model.get() instead of model.attributes
    where: function(attrs, first) {
        if (_.isEmpty(attrs)) return first ? void 0 : [];

        return this[first ? 'find' : 'filter'](function(model) {
        for (var key in attrs) {
          if (attrs[key] !== model.get(key)) return false;
        }
        return true;
       });
    },

    reWrap: function(attr, options) {
        options = options ? options : {};
        _.defaults(options, {
            disableModelEventListener: true
        });
        var collection = new this.constructor(attr, options);
        collection.disableModelEventListenerFlag = (options && options.disableModelEventListener);
        return collection;
    },

    // Yeah... srsly... wupupupupu
    _originalAddReference: Backbone.Collection.prototype._addReference,
    disableModelEventListenerFlag: false,
    _addReference: function(model, options) {
        this._originalAddReference.call(this, model, options);

        if (this.disableModelEventListenerFlag || options.disableModelEventListener) {
            model.off('all', this._onModelEvent, this);
        }
    },

    customClone: function() {
    	return this.reWrap(
			this.models,
			{
				model: this.model,
				comparator: this.comparator,
				disableModelEventListener: true
			}
		);
    },


    filterById: function(idArray) {
        var result = [];
        _.each(idArray, function(id) {
            var model = this.get(id);
            if (model) {
                result.push(model);
            }
        }, this);
        return result;
    },


    // reWrapp & alternative array support
    customWhere: function(param, options) {
        // console.time("customWhere");
        var result = this.filter(function(obj) {
            return obj.matches(param);
        });
        // console.timeEnd("customWhere");
        return this.reWrap(result, options);
    },


    customFindWhere: function (param) {
        return this.find(function(obj) {
            return obj.matches(param);
        });
    },


    customGroupBy: function (param, context, options) {
        var groups = this.groupBy(param, context);
        return _.mapObject(groups, function(group) {
            return this.reWrap(group, options);
        }, this);
    },

    customGroupByWithRequiredKeys: function(param, keys, context, options) {
        var servicesByParam = this.customGroupBy(param, context, options);
        _.each(keys, function(required_key) {
            if (!servicesByParam[required_key]) {
                servicesByParam[required_key] = this.reWrap([], options);
            }
        }, this);
        return servicesByParam;
    },

    customGroupByProperty: function(param, options){
        var groups = _.groupBy(this.models, param);
        return _.mapObject(groups, function(group) {
            return this.reWrap(group, options);
        }, this);
    },


    customFilter: function(f, context, options){
        var result = this.filter(f, context);
        return this.reWrap(result, options);
    },

    customFilterById: function(idArray, options){
        var result = this.filterById(idArray);
        return this.reWrap(result, options);
    },


    customDifference: function(c, options) {
        if (c instanceof Backbone.Collection) {
            c = c.models;
        }
        var result = this.difference(c);
        return this.reWrap(result, options);
    },

    customIntersection: function(c, options) {
        if (c instanceof Backbone.Collection) {
            c = c.models;
        }
        var result = this.intersection(c);
        return this.reWrap(result, options);
    },

    customWithout: function(model, options) {
    	return this.reWrap(
    		this.without(model)
		, options);
    },

    customGroupByMulti: function (values, context, options) {
        if (!values.length) {
            return this;
        }
        var byFirst = this.customGroupBy(values[0], undefined, options),
            rest = values.slice(1);
        for (var prop in byFirst) {
            byFirst[prop] = byFirst[prop].customGroupByMulti(rest, context, options);
        }
        return byFirst;
    },

    customSample: function(n) {
        var result = this.sample(n);
        return this.reWrap(result);
    },

    union: function(input) {
        _.pluralize(input).each(function(item) {
            this.add(item);
        }, this);
        return this;
    },

    containsById: function(containee) {
        containee = containee instanceof Backbone.Model ? containee.id : containee;
        return _.isset(this.get(containee));
    },

    mapWithKey: function(f, context) {
    	return _.mapWithKey(this, f, context);
    },

    customSortBy: function(comparator, options) {
    	options = options || {};
    	this.comparator = comparator;
    	this.sort();

    	if (options.reverse) {

    		this.reverse();

    		if (!options.silent) {
    			this.trigger('sort', this, options);
			}
    	}

    	return this;
    }

});



_.extend(Backbone.View.prototype, {

    reSetElement: function(new_el, options) {
    	options = _.defaults(options || {}, {
    		isAttached: undefined
		});

        // preserve DOM reference
        var $old_el = this.$el;

        // insert new_el
        this.setElement(new_el);

        if (_.isUndefined(options.isAttached)) {
        	options.isAttached = $old_el[0]
        		? $.contains(document, $old_el[0])
        		: false;
        }

        // if old DOM elemt is within DOM: replace with new element
        if ($old_el[0] && options.isAttached) {
            $old_el.replaceWith(this.$el);
        }
    },

    _genericFillWithDefault: function(extendable, data, defaults){
        if( _.isUndefined(extendable) || _.isUndefined(data) || _.isUndefined(defaults) ){
            return false;
        }

        defaults = _.isFunction(defaults)
                    ? defaults()
                    : defaults;

        if( _.isString( extendable ) ){
            if( _.isUndefined( this[extendable] ) || !_.isObject(this[extendable]) ){
                this[extendable] = {};
            }

            extendable = this[extendable];
        }

        _.extend(
            extendable,
            _.pick(
                _.defaults( data, defaults ),
                _.keys( defaults )
            )
        );
    },

    _fillWithDefault: function(extendable, data, context){
        if(_.isUndefined(extendable) || _.isUndefined(data)){
            return false;
        }

        context = context || data.context || this;

        var defaults = _.isFunction(this.defaults) ? this.defaults() : this.defaults;
        _.extend(
            defaults,
            {context: context}
        );

        this._genericFillWithDefault( extendable, data, defaults );

    },

    getTemplateById: function(id){
        if(id.charAt(0) === "#"){
            id = id.substring(1);
        }

        var $id = $("#"+id);
        if($id.length === 1){
            return _.template($id.html());
        }

        // here we can hook a generic template getter
        // but for the moment we simply return an empty template
        console.log("No template for "+id);
        return _.template("");
    },

    /*
    	to be used within listenTo(this.model, "change invalid") listener

    	className: css error class
    	validationResult: Backbone.Model.validationError generate by validateByKey (erroneous keys)
    	keyElementMap: {validationKey: jQ-Selector}

    	uses validation result to add css error class to corresponding elements
     */
    toggleClassByValidateByKey: function(className, validationResult, keyElementMap) {
    	var addClassElements = [],
    		removeClassElements = [];

		validationResult = validationResult || [];

		_.each(keyElementMap, function(element_selector, key) {
			if(_.contains(validationResult, key)) {
				addClassElements.push(element_selector);
			} else {
				removeClassElements.push(element_selector);
			}
		});

		if (addClassElements.length > 0) {
			this.$el.find(addClassElements.join(", ")).addClass(className);
		}
		if (removeClassElements.length > 0) {
			this.$el.find(removeClassElements.join(", ")).removeClass(className);
		}
    },

});