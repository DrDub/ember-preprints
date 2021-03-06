import Ember from 'ember';
import ResetScrollMixin from '../mixins/reset-scroll';
import SetupSubmitControllerMixin from '../mixins/setup-submit-controller';
import Analytics from '../mixins/analytics';
import config from 'ember-get-config';
import loadAll from 'ember-osf/utils/load-relationship';
import permissions from 'ember-osf/const/permissions';

export default Ember.Route.extend(Analytics, ResetScrollMixin, SetupSubmitControllerMixin, {
    theme: Ember.inject.service(),
    headTagsService: Ember.inject.service('head-tags'),
    currentUser: Ember.inject.service('currentUser'),
    queryParams: {
        edit: {
            refreshModel: true // if queryParam, do a full transition
        }
    },
    setup() {
        // Overrides setup method.  If query param /?edit is present, uses 'submit' controller instead.
        this.set('controllerName', this.get('editMode') ? 'submit' : 'content');
        return this._super(...arguments);
    },
    renderTemplate() {
        // Overrides renderTemplate method.  If query param /?edit is present, uses 'submit' template instead.
        this.render(this.get('editMode') ? 'submit' : 'content');
    },
    model(params) {
        if (params.edit)
            this.set('editMode', true);

        return this
            .store
            .findRecord('preprint', params.preprint_id);
    },
    setupController(controller, model) {
        if (this.get('editMode')) {
            // Runs setupController for 'submit'
            this.setupSubmitController(controller, model);
        } else {
            // Runs setupController for 'content'
            controller.set('activeFile', model.get('primaryFile'));
            controller.set('node', this.get('node'));
            Ember.run.scheduleOnce('afterRender', this, function() {
                MathJax.Hub.Queue(['Typeset', MathJax.Hub, [Ember.$('.abstract')[0], Ember.$('#preprintTitle')[0]]]);  // jshint ignore:line
            });
        }

        return this._super(...arguments);
    },
    afterModel(preprint) {
        // Redirect if necessary
        preprint.get('provider')
            .then(provider => {
                const providerId = provider.get('id');
                const themeId = this.get('theme.id');
                const isOSF = providerId === 'osf';

                // If we're on the proper branded site, stay there.
                if ((!themeId && isOSF) || themeId === providerId)
                    return;

                // Otherwise, redirect to the branded page
                // Hard redirect instead of transition, in anticipation of Phase 2 where providers will have their own domains.
                const {origin, search} = window.location;

                const urlParts = [
                    origin
                ];

                if (!isOSF)
                    urlParts.push('preprints', providerId);

                urlParts.push(preprint.get('id'), search);

                const url = urlParts.join('/');

                window.history.replaceState({}, document.title, url);
                window.location.replace(url);
            });

        return preprint.get('node').then(node => {
            this.set('node', node);

            if (this.get('editMode')) {
                let userPermissions = this.get('node.currentUserPermissions') || [];
                if (userPermissions.indexOf(permissions.ADMIN) === -1) {
                    this.replaceWith('forbidden'); // Non-admin trying to access edit form.
                }
            }

            const {origin} = window.location;
            const image = this.get('theme.logoSharing');
            const imageUrl = `${origin.replace(/^https/, 'http')}${image.path}`;
            const dateCreated = new Date(preprint.get('dateCreated'));
            const ogp = [
                ['fb:app_id', config.FB_APP_ID],
                ['og:title', node.get('title')],
                ['og:image', imageUrl],
                ['og:image:secure_url', `${origin}${image.path}`], // We should always be on https in staging/prod
                ['og:image:width', image.width.toString()],
                ['og:image:height', image.height.toString()],
                ['og:image:type', image.type],
                ['og:url', preprint.get('links.html')],
                ['og:description', node.get('description')],
                ['og:site_name', this.get('theme.provider.name')],
                ['og:type', 'article'],
                ['article:published_time', dateCreated.toISOString()],
                ['article:modified_time', new Date(preprint.get('dateModified')).toISOString()],
                ['citation_title', node.get('title')],
                ['citation_description', node.get('description')],
                ['citation_public_url', preprint.get('links.html')],
                ['citation_publication_date', `${dateCreated.getFullYear()}/${dateCreated.getMonth() + 1}/${dateCreated.getDate()}`],
                ['citation_doi', preprint.get('doi')],
                ['dc.title', node.get('title')],
                ['dc.abstract', node.get('description')],
                ['dc.identifier', preprint.get('links.html')],
                ['dc.identifier', preprint.get('doi')],
            ];

            const tags = [
                ...preprint.get('subjects').map(subjectBlock => subjectBlock.map(subject => subject.text)),
                ...node.get('tags')
            ];

            for (const tag of tags)
                ogp.push(
                    ['article:tag', tag],
                    ['citation_keywords', tag],
                    ['dc.subject', tag]
                );

            let contributors = Ember.A();

            loadAll(node, 'contributors', contributors).then(() => {
                contributors.forEach(contributor => {
                    ogp.push(
                        ['og:type', 'article:author'],
                        ['profile:first_name', contributor.get('users.givenName')],
                        ['profile:last_name', contributor.get('users.familyName')],
                        ['citation_author', `${contributor.get('users.givenName')} ${contributor.get('users.familyName')}`],
                        ['dc.creator', `${contributor.get('users.givenName')} ${contributor.get('users.familyName')}`]
                    );
                });

                this.set('headTags', ogp.map(item => (
                    {
                        type: 'meta',
                        attrs: {
                            property: item[0],
                            content: item[1]
                        }
                    }
                )));

                this.get('headTagsService').collectHeadTags();

                preprint.get('provider').then(provider => {
                    ogp.push(
                        ['citation_publisher', provider.get('name')],
                        ['dc.publisher', provider.get('name')]
                    );
                    preprint.get('license').then(license => {
                        ogp.push(
                            ['dc.license', license.get('name')]
                        );
                        preprint.get('primaryFile').then(file => {
                            if (file.get('name').split('.').pop() === 'pdf') {
                                ogp.push(
                                    ['citation_pdf_url', file.get('links').download]
                                );
                            }
                            this.set('headTags', ogp.map(item => (
                                {
                                    type: 'meta',
                                    attrs: {
                                        property: item[0],
                                        content: item[1]
                                    }
                                }
                            )));
                            this.get('headTagsService').collectHeadTags();
                        });
                    });
                });
            });
        });
    },
    actions: {
        error(error, transition) {
            if (error && error.errors && Ember.isArray(error.errors) && error.errors[0].detail === 'The requested node is no longer available.') {
                this.intermediateTransitionTo('resource-deleted'); // Node containing preprint has been deleted. 410 Gone.
            } else {
                const slug = transition.params[transition.targetName].preprint_id;

                if (slug.length === 5) {
                    window.location.href = [
                        window.location.origin,
                        slug
                    ].join('/');
                } else {
                    const path = ['', 'preprints'];

                    if (this.get('theme.isProvider'))
                        path.push(this.get('theme.id'));

                    path.push(slug);

                    window.history.replaceState({}, 'preprints', path.join('/'));
                    this.intermediateTransitionTo('page-not-found');
                }
            }
        }
    }
});
