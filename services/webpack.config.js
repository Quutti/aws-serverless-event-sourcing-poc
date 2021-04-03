const path = require('path');

const resolveEntrypoints = (...filenames) => {
    const entry = {};
    filenames.forEach(filename =>
        entry[filename] = path.join(__dirname, 'src', `${filename}.ts`)
    );
    return entry;
};

module.exports = () => {

    const config = {};

    config.mode = 'development';

    config.entry = resolveEntrypoints(
        'addEvent',
        'eventStoreStreamHandler',
        'eventStoreFrontendQueueHandler',
        'testProjector',
        'listTestItems',
        'replay',
        'triggerReplay'
    );

    config.output = {
        path: path.join(__dirname, '.webpack'),
        libraryTarget: 'commonjs2',
        filename: '[name].js',
    }

    config.resolve = {
        extensions: ['.js', '.ts']
    }

    config.module = {}
    config.module.rules = []

    config.module.rules.push({
        use: 'ts-loader',
        test: /\.ts$/
    });

    config.externals = {
        'aws-sdk': 'commonjs2 aws-sdk'
    }

    config.target = 'node';

    return config;
};