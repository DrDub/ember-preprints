import Ember from 'ember';
import Analytics from '../mixins/analytics';

/**
 * Convert Or Copy Widget - very simple, just presents decision, do you want to convert this project or copy file to a new component.
 *
 * Will set convertOrCopy to 'convert' or 'copy'.  If convert, will set node title as current node title and titleValid to
 * true. If 'copy', nodeTitle will be set equal to null, and titleValid to false.  Converting a project requires the user confirm their
 * decision in an additional step.
 *
 * Sample usage:
 * ```handlebars
 * {{convert-or-copy-project
 *  convertOrCopy=convertOrCopy
 *  titleValid=titleValid
 *  nodeTitle=nodeTitle
 *  node=node
 *  convertProjectConfirmed=convertProjectConfirmed
 *}}
 * ```
 * @class convert-or-copy-project
 */
export default Ember.Component.extend(Analytics, {
    actions: {
        chooseCopyToComponent() {
            // Decision to create a component to contain the preprint
            this.attrs.clearDownstreamFields('belowConvertOrCopy');
            this.set('convertProjectConfirmed', false);
            this.set('convertOrCopy', 'copy');
            this.set('titleValid', false);
            this.set('nodeTitle', null);
            this.attrs.nextUploadSection('organize', 'finalizeUpload');
            Ember.get(this, 'metrics')
                .trackEvent({
                    category: 'button',
                    action: 'click',
                    label: 'Preprints - Submit - Make a New Component Selection'
                });

        },
        chooseConvertExisting() {
            // Decision to have the existing project contain the preprint
            this.set('convertProjectConfirmed', false);
            this.set('convertOrCopy', 'convert');
            if (this.get('node')) {
                this.set('nodeTitle', this.get('node.title'));
                this.set('titleValid', true);
            }
            Ember.get(this, 'metrics')
                .trackEvent({
                    category: 'button',
                    action: 'click',
                    label: 'Preprints - Submit - Use the Current Project Selection'
                });
        },
        confirmConvert() {
            // Confirmation that user wishes to use existing project to contain preprint,
            // as edits to the preprint will edit the project.
            this.set('convertProjectConfirmed', true);
            this.attrs.nextUploadSection('organize', 'finalizeUpload');
            Ember.get(this, 'metrics')
                .trackEvent({
                    category: 'button',
                    action: 'click',
                    label: 'Preprints - Submit - Confirm Continue with the Current Project'
                });
        }
    }
});
