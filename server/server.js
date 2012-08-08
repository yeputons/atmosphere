Packages = new Meteor.Collection('packages');
Packages.allow({});

Meteor.publish('packages', function(options) {
  options || (options = {});
  options.includeHidden = _.isUndefined(options.includeHidden) ? false : options.includeHidden;
  var query = {};
  if (!options.includeHidden)
    query.visible = {$ne: false};
  return Packages.find(query, {
    sort: {
      lastUpdatedAt: -1
    }
  });
});

Meteor.methods({
  publish: function(pkgInfo) {

    var allowedFields = [
      'name',
      'description',
      'homepage',
      'author',
      'version',
      'git',
      'packages',
      'visible'
    ];

    var requiredFields = [
      'name',
      'description',
      'homepage',
      'author',
      'version',
      'git'
    ];

    var cleanupPackage = function(obj) {
      return _.reduce(allowedFields, function(newObj, key) {
        if (!_.isUndefined(obj[key]))
          newObj[key] = obj[key];
        return newObj;
      }, {});
    };

    var prepareForUpdate = function(obj) {
      delete obj._id;
      return obj;
    };

    var requireFields = function(obj) {
      _.each(requiredFields, function(reqField) {
        if (!obj[reqField])
          throw new Meteor.Error(500, reqField + " is a required smart.json field!");
      });
    };

    // Validate
    // TODO do a lot more
    requireFields(pkgInfo);
    
    // Get rid of keys we don't want
    pkgInfo = cleanupPackage(pkgInfo);

    // Setup defaults
    pkgInfo.visible = _.isUndefined(pkgInfo.visible) ? true : pkgInfo.visible;

    // Let's see if we have a record for the package
    var pkgRecord = Packages.findOne({ name: pkgInfo.name });

    // Ok we have one
    if (pkgRecord) {

      // Only the owner can update it
      if (pkgRecord.userId !== this.userId())
        throw new Meteor.Error(401, "That ain't yr package son!")
      
      if (pkgRecord.latest === pkgInfo.version) {

        // Update
        var lastIndex = pkgRecord.versions.length - 1;
        pkgRecord.versions[lastIndex].version = pkgInfo.version;
        pkgRecord.versions[lastIndex].version.git = pkgInfo.git;
        if (pkgInfo.packages)
          pkgRecord.versions[lastIndex].packages = pkgInfo.packages;
        var now = new Date();
        pkgRecord.versions[lastIndex].updatedAt.push(now);
        pkgRecord.lastUpdatedAt = now;
      
      } else {

        // Add new version
        var now = new Date();
        pkgRecord.versions.push({
          git: pkgInfo.git,
          version: pkgInfo.version,
          createdAt: now,
          updatedAt: [now]
        });
        pkgRecord.lastUpdatedAt = now;


        // Assign packages
        if (pkgInfo.packages)
          pkgRecord.packages = pkgInfo.packages;

        pkgRecord.latest = pkgInfo.version;
      }

      // Timestamp it
      var now = new Date();
      pkgRecord.updatedAt.push(now);
      pkgRecord.lastUpdatedAt = now;
      pkgRecord.git = pkgInfo.git;
      
      // Get the update ID before
      var id = pkgRecord._id;

      // Do the update
      Packages.update(id, {
        $set: prepareForUpdate(pkgRecord)
      });
    } else {

      // Prepare new package record
      pkgInfo.userId = this.userId();
      pkgInfo.latest = pkgInfo.version;
      var now = new Date();
      pkgInfo.createdAt = now;
      pkgInfo.updatedAt = [now];
      pkgInfo.lastUpdatedAt = now;

      // Setup first version
      pkgInfo.versions = [{
        git: pkgInfo.git,
        version: pkgInfo.version,
        createdAt: now,
        updatedAt: [now]
      }];
      
      // Assign packages
      if (pkgInfo.packages)
        version.packages = pkgInfo.packages;
      
      Packages.insert(pkgInfo);
    }
  }
});
