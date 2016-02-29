var os = require('os')
var path = require('path')
var fs = require('fs')
var builder = require('xmlbuilder')

var JUnitReporter = function (baseReporterDecorator, config, logger, helper, formatError) {
  var log = logger.create('reporter.junit')
  var reporterConfig = config.junitReporter || {}
  var pkgName = reporterConfig.suite || ''
  var outputDir = reporterConfig.outputDir
  var outputFile = reporterConfig.outputFile
  var useBrowserName = reporterConfig.useBrowserName
  var nameFormatter = reporterConfig.nameFormatter
  var classNameFormatter = reporterConfig.classNameFormatter

  var suites
  var pendingFileWritings = 0
  var fileWritingFinished = function () {}
  var allMessages = []

  if (outputDir == null) {
    outputDir = '.'
  }

  outputDir = helper.normalizeWinPath(path.resolve(config.basePath, outputDir)) + path.sep

  if (typeof useBrowserName === 'undefined') {
    useBrowserName = true
  }

  baseReporterDecorator(this)

  this.adapters = [
    function (msg) {
      allMessages.push(msg)
    }
  ]

  var initializeXmlForBrowser = function (browser) {
    var timestamp = (new Date()).toISOString().substr(0, 19)
    var suite = suites[browser.id] = builder.create('testsuite')
    suite.att('name', browser.name)
      .att('package', pkgName)
      .att('timestamp', timestamp)
      .att('id', 0)
      .att('hostname', os.hostname())

    suite.ele('properties')
      .ele('property', {name: 'browser.fullName', value: browser.fullName})
  }

  var writeXmlForBrowser = function (browser) {
    var safeBrowserName = browser.name.replace(/ /g, '_')
    var newOutputFile
    if (outputFile != null) {
      var dir = useBrowserName ? path.join(outputDir, safeBrowserName)
                               : outputDir
      newOutputFile = path.join(dir, outputFile)
    } else if (useBrowserName) {
      newOutputFile = path.join(outputDir, 'TESTS-' + safeBrowserName + '.xml')
    } else {
      newOutputFile = path.join(outputDir, 'TESTS.xml')
    }

    var xmlToOutput = suites[browser.id]
    if (!xmlToOutput) {
      return // don't die if browser didn't start
    }

    pendingFileWritings++
    helper.mkdirIfNotExists(path.dirname(newOutputFile), function () {
      fs.writeFile(newOutputFile, xmlToOutput.end({pretty: true}), function (err) {
        if (err) {
          log.warn('Cannot write JUnit xml\n\t' + err.message)
        } else {
          log.debug('JUnit results written to "%s".', newOutputFile)
        }

        if (!--pendingFileWritings) {
          fileWritingFinished()
        }
      })
    })
  }

  var getClassName = function (browser, result) {
    var browserName = browser.name.replace(/ /g, '_').replace(/\./g, '_') + '.'

    return (useBrowserName ? browserName : '') + (pkgName ? pkgName + '.' : '') + result.suite[0]
  }

  this.onRunStart = function (browsers) {
    suites = Object.create(null)

    // TODO(vojta): remove once we don't care about Karma 0.10
    browsers.forEach(initializeXmlForBrowser)
  }

  this.onBrowserRegister = function (browser) {
    console.log('Processing on browser register')
    console.log('browser:')
    console.log(browser)
  }

  this.onBrowserError = function (browser, error) {
    console.log('Processing on browser error')
    console.log('browser:')
    console.log(browser)
    console.log('error:')
    console.log(error)
  }

  this.onBrowserStart = function (browser, info) {
    console.log('Processing on browser start')
    console.log('browser:')
    console.log(browser)
    console.log('info:')
    console.log(info)
    initializeXmlForBrowser(browser)
  }

  this.onBrowsersChange = function (browsers) {
    console.log('Processing on browsers change')
    console.log('browsers:')
    browsers.forEach(function(browser) {
      console.log('browser:')
      console.log(browser)
    })
  }

  this.onBrowserComplete = function (browser, results) {
    console.log('Processing on browser complete')
    console.log('browser sending complete')
    console.log(browser)
    console.log('results:')
    console.log(results)
    if (browser.state != 1))
    var suite = suites[browser.id]
    var result = browser.lastResult
    if (!suite || !result) {
      return // don't die if browser didn't start
    }

    suite.att('tests', result.total)
    suite.att('errors', result.disconnected || result.error ? 1 : 0)
    suite.att('failures', result.failed)
    suite.att('time', (result.netTime || 0) / 1000)

    suite.ele('system-out').dat(allMessages.join() + '\n')
    suite.ele('system-err')

    writeXmlForBrowser(browser)
  }

  this.onRunStart = function (browsers) {
      console.log('Processing on run start')
      console.log('browsers')
      browsers.forEach(function(browser) {
        console.log('browser:')
        console.log(browser)
      })
  }

  this.onRunComplete = function (runningBrowsers, results) {
    console.log('Processing on run complete')
    console.log('Running browsers')
    runningBrowsers.forEach(function(browser) {
        console.log('Browser:')
        console.log(browser)
    })
    console.log('results:')
    console.log(results)
    suites = null
    allMessages.length = 0
  }

  this.specSuccess = this.specSkipped = this.specFailure = function (browser, result) {
    var spec = suites[browser.id].ele('testcase', {
      name: typeof nameFormatter === 'function' ? nameFormatter(browser, result) : result.description,
      time: ((result.time || 0) / 1000),
      classname: (typeof classNameFormatter === 'function' ? classNameFormatter : getClassName)(browser, result)
    })

    if (result.skipped) {
      spec.ele('skipped')
    }

    if (!result.success) {
      result.log.forEach(function (err) {
        spec.ele('failure', {type: ''}, formatError(err))
      })
    }
  }

  // wait for writing all the xml files, before exiting
  this.onExit = function (done) {
    if (pendingFileWritings) {
      fileWritingFinished = done
    } else {
      done()
    }
  }
}

JUnitReporter.$inject = ['baseReporterDecorator', 'config', 'logger', 'helper', 'formatError']

// PUBLISH DI MODULE
module.exports = {
  'reporter:junit': ['type', JUnitReporter]
}
