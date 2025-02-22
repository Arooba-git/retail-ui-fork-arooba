/* eslint-disable jsx-a11y/anchor-has-content */
/* eslint-disable react/display-name */
/* eslint-disable react/no-unstable-nested-components */
import React, { useState } from 'react';
import { mount, ReactWrapper } from 'enzyme';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HTMLProps } from 'react-ui/typings/html-props';

import { MenuMessage } from '../../../internal/MenuMessage';
import { CustomComboBoxLocaleHelper } from '../../../internal/CustomComboBox/locale';
import { LangCodes, LocaleContext } from '../../../lib/locale';
import { defaultLangCode } from '../../../lib/locale/constants';
import { ComboBox, ComboBoxProps } from '../ComboBox';
import { InputLikeText, InputLikeTextDataTids } from '../../../internal/InputLikeText';
import { MenuItem } from '../../MenuItem';
import { Menu } from '../../../internal/Menu';
import { delay } from '../../../lib/utils';
import {
  ComboBoxMenuDataTids,
  CustomComboBox,
  DELAY_BEFORE_SHOW_LOADER,
  LOADER_SHOW_TIME,
} from '../../../internal/CustomComboBox';
import { ComboBoxView } from '../../../internal/CustomComboBox/ComboBoxView';
import { ComboBoxRequestStatus } from '../../../internal/CustomComboBox/CustomComboBoxTypes';
import { buildMountAttachTarget, getAttachedTarget } from '../../../lib/__tests__/testUtils';

function clickOutside() {
  const event = document.createEvent('HTMLEvents');
  event.initEvent('mousedown', true, true);

  document.body.dispatchEvent(event);
}

function searchFactory<T = string[]>(promise: Promise<T>): [jest.Mock<Promise<T>>, Promise<void>] {
  let searchCalled: () => Promise<void>;
  const searchPromise = new Promise<void>(
    (resolve) =>
      (searchCalled = async () => {
        await delay(0);

        return resolve();
      }),
  );
  const search = jest.fn(() => {
    searchCalled();

    return promise;
  });

  return [search, searchPromise];
}

describe('ComboBox', () => {
  buildMountAttachTarget();

  it('renders', () => {
    expect(() => mount<ComboBox<any>>(<ComboBox getItems={() => Promise.resolve([])} />)).not.toThrow();
  });

  it('focuses on focus call', () => {
    const wrapper = mount<ComboBox<any>>(<ComboBox getItems={() => Promise.resolve([])} />, {
      attachTo: getAttachedTarget(),
    });
    wrapper.find(ComboBoxView).prop('onFocus')?.();
    expect(wrapper.getDOMNode().contains(document.activeElement)).toBeTruthy();
  });

  it('fetches item when focused', () => {
    const search = jest.fn(() => Promise.resolve([]));
    const wrapper = mount<ComboBox<any>>(<ComboBox getItems={search} />);
    wrapper.find(ComboBoxView).prop('onFocus')?.();
    expect(search).toHaveBeenCalledWith('');
  });

  it('fetches items on input', () => {
    const search = jest.fn(() => Promise.resolve([]));
    const wrapper = mount<ComboBox<any>>(<ComboBox getItems={search} />);

    wrapper.find(ComboBoxView).prop('onFocus')?.();
    wrapper.update();
    wrapper.find('input').simulate('change', { target: { value: 'world' } });

    expect(search).toHaveBeenCalled();
    expect(search).toHaveBeenCalledTimes(2);
    expect((search.mock.calls as string[][])[1][0]).toBe('world');
  });

  it('opens menu in dropdown container on search resolve', async () => {
    const [search, promise] = searchFactory(Promise.resolve(['one', 'two']));
    const wrapper = mount<ComboBox<string>>(<ComboBox getItems={search} />);

    wrapper.find(ComboBoxView).prop('onFocus')?.();

    await promise;

    wrapper.update();

    expect(wrapper.find(Menu)).toHaveLength(1);
  });

  it('sets items on search resolve', async () => {
    const items = ['one', 'two', 'three'];
    const [search, promise] = searchFactory(Promise.resolve(items));
    const wrapper = mount<ComboBox<string>>(<ComboBox getItems={search} renderItem={(x) => x} />);

    wrapper.find(ComboBoxView).prop('onFocus')?.();

    await promise;

    wrapper.update();

    expect(wrapper.find(MenuItem)).toHaveLength(items.length);

    wrapper.find(MenuItem).forEach((item, index) => {
      expect(item.text()).toBe(items[index]);
    });
  });

  it('calls onValueChange if clicked on item', async () => {
    const items = ['one', 'two', 'three'];
    const [search, promise] = searchFactory(Promise.resolve(items));
    const onValueChange = jest.fn();
    const wrapper = mount<ComboBox<string>>(
      <ComboBox getItems={search} onValueChange={onValueChange} renderItem={(x) => x} />,
    );
    wrapper.find(ComboBoxView).prop('onFocus')?.();
    await promise;
    wrapper.update();

    wrapper.find(MenuItem).first().simulate('click');

    expect(onValueChange).toHaveBeenCalledWith('one');
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it('selects first item on Enter', async () => {
    const items = ['one', 'two', 'three'];
    const [search, promise] = searchFactory(Promise.resolve(items));
    const onValueChange = jest.fn();
    const wrapper = mount<ComboBox<string>>(
      <ComboBox getItems={search} onValueChange={onValueChange} renderItem={(x) => x} value={'one'} />,
    );
    wrapper.find(ComboBoxView).prop('onFocus')?.();
    await promise;
    wrapper.update();

    wrapper.find('input').simulate('keydown', { key: 'Enter' });

    expect(onValueChange).toHaveBeenCalledWith('one');
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it('retries request on Enter if rejected', async () => {
    const [search, promise] = searchFactory(Promise.reject());
    const wrapper = mount<ComboBox<string>>(<ComboBox getItems={search} renderItem={(x) => x} />);
    wrapper.find(ComboBoxView).prop('onFocus')?.();
    await promise;
    wrapper.update();

    await delay(100);

    wrapper.find('input').simulate('keydown', { key: 'Enter' });

    await delay(0);

    expect(search).toHaveBeenCalledWith('');
    expect(search).toHaveBeenCalledTimes(2);
  });

  it('keeps focus after a click on the refresh button', async () => {
    const [search, promise] = searchFactory(Promise.reject());
    const wrapper = mount<ComboBox<string>>(<ComboBox getItems={search} renderItem={(x) => x} />, {
      attachTo: getAttachedTarget(),
    });

    wrapper.find(ComboBoxView).prop('onFocus')?.();
    await promise;
    wrapper.update();

    const inputNode = wrapper.find('input').getDOMNode() as HTMLElement;

    inputNode.blur(); // simulate blur from real click
    wrapper.find(MenuItem).last().simulate('click');
    await delay(0);
    wrapper.update();

    expect(search).toHaveBeenCalledTimes(2);
    expect(inputNode).toHaveFocus();
  });

  it('calls onUnexpectedInput on click outside', async () => {
    const [search, promise] = searchFactory(Promise.reject());
    const onUnexpectedInput = jest.fn();
    const wrapper = mount<ComboBox<string>>(<ComboBox getItems={search} onUnexpectedInput={onUnexpectedInput} />);

    wrapper.find(ComboBoxView).prop('onFocus')?.();
    wrapper.update();
    wrapper.find('input').simulate('change', { target: { value: 'one' } });

    await promise;

    clickOutside();
    await delay(0);

    expect(onUnexpectedInput).toHaveBeenCalledWith('one');
    expect(onUnexpectedInput).toHaveBeenCalledTimes(1);
  });

  it('calls onValueChange if onUnexpectedInput return defined value', async () => {
    const values = [null, undefined, 'one'];
    const onValueChange = jest.fn();
    const wrapper = mount<ComboBox<string>>(
      <ComboBox
        onValueChange={onValueChange}
        onUnexpectedInput={(value) => value}
        getItems={() => Promise.resolve([])}
      />,
    );

    while (values.length) {
      wrapper.find(ComboBoxView).prop('onFocus')?.();
      wrapper.update();
      await delay(0);
      wrapper.find('input').simulate('change', { target: { value: values.pop() } });
      clickOutside();
      await delay(0);
    }

    expect(onValueChange).toHaveBeenCalledWith(null);
    expect(onValueChange).toHaveBeenCalledWith('one');
    expect(onValueChange).not.toHaveBeenCalledWith(undefined);
  });

  it('calls onFocus on focus', () => {
    const onFocus = jest.fn();
    const wrapper = mount<ComboBox<any>>(<ComboBox onFocus={onFocus} getItems={() => Promise.resolve([])} />);

    wrapper.find('[tabIndex=0]').simulate('focus');

    expect(onFocus).toHaveBeenCalledTimes(1);
  });

  describe('onBlur callback', () => {
    const onBlur = jest.fn();
    const [search, promise] = searchFactory(Promise.resolve(['item']));
    const wrapper = mount<ComboBox<string>>(<ComboBox getItems={search} onBlur={onBlur} />);

    beforeEach(() => {
      wrapper.instance().reset();
      onBlur.mockClear();
    });

    it('calls onBlur on click outside when menu is open', async () => {
      wrapper.find(ComboBoxView).prop('onFocus')?.();

      await promise;
      wrapper.update();

      expect(wrapper.find(CustomComboBox).instance().state).toMatchObject({
        opened: true,
      });
      clickOutside();
      await delay(0);

      expect(onBlur).toHaveBeenCalledTimes(1);
    });

    it('calls onBlur on input blur when menu is closed', async () => {
      wrapper.find(ComboBoxView).prop('onFocus')?.();
      wrapper.update();

      expect(wrapper.find(CustomComboBox).instance().state).toMatchObject({
        opened: false,
      });
      wrapper.find('input').simulate('blur');
      await delay(0);

      expect(onBlur).toHaveBeenCalledTimes(1);
    });
  });

  it('renders custom elements in menu', async () => {
    const items = [<div key="0">Hello, world</div>];
    const [search, promise] = searchFactory(Promise.resolve(items));
    const wrapper = mount<ComboBox<React.ReactNode>>(<ComboBox getItems={search} />);

    wrapper.find(ComboBoxView).prop('onFocus')?.();
    await promise;
    wrapper.update();

    expect(wrapper.find(Menu).containsAllMatchingElements(items)).toBeTruthy();
  });

  it('calls default onClick on custom element select', async () => {
    const items = [
      <div key="0" id="hello" data-name="world">
        Hello, world
      </div>,
    ];
    const [search, promise] = searchFactory(Promise.resolve(items));
    const onValueChange = jest.fn();
    const wrapper = mount<ComboBox<React.ReactNode>>(<ComboBox getItems={search} onValueChange={onValueChange} />);

    wrapper.find(ComboBoxView).prop('onFocus')?.();
    await promise;
    wrapper.update();

    wrapper.findWhere((x) => x.matchesElement(<div>Hello, world</div>)).simulate('click');

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith({
      id: 'hello',
      'data-name': 'world',
      children: 'Hello, world',
    });
  });

  it('calls element onClick on custom element select', async () => {
    const onClick = jest.fn();
    const items = [
      <div key="0" onClick={onClick}>
        Hello, world
      </div>,
    ];
    const [search, promise] = searchFactory(Promise.resolve(items));

    const wrapper = mount<ComboBox<React.ReactNode>>(<ComboBox getItems={search} />);

    wrapper.find(ComboBoxView).prop('onFocus')?.();

    await promise;
    wrapper.update();

    wrapper.findWhere((x) => x.matchesElement(<div>Hello, world</div>)).simulate('click');

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('handles maxLength', async () => {
    const [search, promise] = searchFactory(Promise.resolve([]));
    const wrapper = mount<ComboBox<any>>(<ComboBox getItems={search} maxLength={2} />);

    wrapper.find(ComboBoxView).prop('onFocus')?.();
    await promise;
    wrapper.update();

    const input = wrapper.find('input');
    expect(input.prop('maxLength')).toBe(2);
  });

  it("don't focus on error and value change", () => {
    const wrapper = mount<ComboBox<any>>(<ComboBox getItems={() => Promise.resolve([])} />);

    wrapper.setProps({ value: { label: '1' }, error: true });
    wrapper.update();

    expect(wrapper.find(InputLikeText).exists()).toBe(true);
  });

  it('clear input value if onUnexpectedInput return null', async () => {
    const wrapper = mount<ComboBox<any>>(
      <ComboBox onUnexpectedInput={() => null} getItems={() => Promise.resolve([])} />,
    );

    wrapper.find(ComboBoxView).prop('onFocus')?.();
    wrapper.update();
    await delay(0);
    wrapper.find('input').simulate('change', { target: { value: 'foo' } });

    clickOutside();
    await delay(0);
    wrapper.update();

    expect(wrapper.find('CustomComboBox').state('textValue')).toBe('');
  });

  it("shouldn't open on receive items if not focused", async () => {
    const [search] = searchFactory(delay(500).then(() => []));
    const wrapper = mount<ComboBox<any>>(<ComboBox getItems={search} />);

    wrapper.find(ComboBoxView).prop('onFocus')?.();
    await delay(300);
    wrapper.update();

    expect(wrapper.find(ComboBoxView).prop('loading')).toBe(true);
    expect(wrapper.find(ComboBoxView).prop('opened')).toBe(true);

    clickOutside();
    await delay(0);
    wrapper.update();

    expect(wrapper.find(ComboBoxView).prop('loading')).toBe(false);
    expect(wrapper.find(ComboBoxView).prop('opened')).toBe(false);

    await delay(1000);
    wrapper.update();

    expect(wrapper.find(ComboBoxView).prop('loading')).toBe(false);
    expect(wrapper.find(ComboBoxView).prop('opened')).toBe(false);
    expect(wrapper.find(CustomComboBox).instance().state).toMatchObject({
      loading: false,
      opened: false,
      requestStatus: ComboBoxRequestStatus.Unknown,
    });
  });

  it('does not highlight menu item on focus with empty input', async () => {
    const items = ['one', 'two', 'three'];
    const [search, promise] = searchFactory(Promise.resolve(items));
    const wrapper = mount<ComboBox<string>>(<ComboBox getItems={search} renderItem={(x) => x} />);

    wrapper.find(ComboBoxView).prop('onFocus')?.();

    await promise;

    wrapper.update();

    const menuInstance = wrapper.find(Menu).instance() as Menu;
    expect(menuInstance.hasHighlightedItem()).toBe(false);
  });

  it('highlights menu item on focus with non-empty input', async () => {
    const items = ['one', 'two', 'three'];
    const [search, promise] = searchFactory(Promise.resolve(items));
    const wrapper = mount<ComboBox<string>>(<ComboBox getItems={search} renderItem={(x) => x} value={'one'} />);

    wrapper.find(ComboBoxView).prop('onFocus')?.();

    await promise;

    wrapper.update();

    const menuInstance = wrapper.find(Menu).instance() as Menu;
    expect(menuInstance.hasHighlightedItem()).toBe(true);
  });

  describe('update input text when value changes if there was no editing', () => {
    const VALUES = [
      { value: 1, label: 'one' },
      { value: 2, label: 'two' },
    ];
    const check = async (wrapper: ReactWrapper<ComboBoxProps<any>, unknown, ComboBox<any>>) => {
      wrapper.find(ComboBoxView).prop('onFocus')?.();
      wrapper.update();
      expect(wrapper.find('input').prop('value')).toBe(VALUES[0].label);

      wrapper.instance().blur();
      await delay(0);
      wrapper.setProps({ value: VALUES[1] });
      wrapper.find(ComboBoxView).prop('onFocus')?.();
      wrapper.update();
      expect(wrapper.find('input').prop('value')).toBe(VALUES[1].label);

      wrapper.instance().blur();
      await delay(0);
      wrapper.setProps({ value: null });
      wrapper.find(ComboBoxView).prop('onFocus')?.();
      wrapper.update();
      expect(wrapper.find('input').prop('value')).toBe('');
    };

    it('in default mode', () => {
      expect(() =>
        check(mount<ComboBox<any>>(<ComboBox value={VALUES[0]} getItems={() => Promise.resolve(VALUES)} />)),
      ).not.toThrow();
    });

    it('in autocomplete mode', () => {
      expect(() =>
        check(
          mount<ComboBox<any>>(
            <ComboBox
              value={VALUES[0]}
              drawArrow={false}
              searchOnFocus={false}
              getItems={() => Promise.resolve(VALUES)}
            />,
          ),
        ),
      ).not.toThrow();
    });
  });

  describe('keep edited input text when value changes', () => {
    const value = { value: 1, label: 'one' };
    const check = (wrapper: any) => {
      wrapper.find(ComboBoxView).prop('onFocus')?.();
      wrapper.update();
      wrapper.find('input').simulate('change', { target: { value: 'two' } });

      clickOutside();
      wrapper.setProps({ value: null });

      wrapper.find(ComboBoxView).prop('onFocus')?.();
      wrapper.update();
      expect(wrapper.find('input').prop('value')).toBe('two');
    };

    it('in default mode', () => {
      expect(() =>
        check(mount<ComboBox<any>>(<ComboBox value={value} getItems={() => Promise.resolve([value])} />)),
      ).not.toThrow();
    });

    it('in autocomplete mode', () => {
      expect(() =>
        check(
          mount<ComboBox<any>>(
            <ComboBox
              value={value}
              drawArrow={false}
              searchOnFocus={false}
              getItems={() => Promise.resolve([value])}
            />,
          ),
        ),
      ).not.toThrow();
    });
  });

  it('does not do search on focus in autocomplete mode', async () => {
    const value = { value: 1, label: 'one' };
    const getItems = jest.fn();
    const wrapper = mount<ComboBox<any>>(
      <ComboBox getItems={getItems} value={value} drawArrow={false} searchOnFocus={false} />,
    );

    wrapper.find(ComboBoxView).prop('onFocus')?.();
    await delay(0);
    wrapper.update();

    expect(getItems).toHaveBeenCalledTimes(0);
    expect(wrapper.find(Menu)).toHaveLength(0);
  });

  it('reset', () => {
    const wrapper = mount<ComboBox<any>>(<ComboBox getItems={() => Promise.resolve([])} />);

    wrapper.find(ComboBoxView).prop('onFocus')?.();
    wrapper.update();
    wrapper.find('input').simulate('change', { target: { value: 'foo' } });

    expect(wrapper.find('input').prop('value')).toBe('foo');

    clickOutside();
    wrapper.instance().reset();

    wrapper.update();

    expect(wrapper.find(InputLikeText).text()).toBe('');
  });

  it('onValueChange if single item', async () => {
    const ITEMS = [
      { value: 1, label: 'One' },
      { value: 2, label: 'Two' },
      { value: 3, label: 'Three' },
      { value: 4, label: 'Four' },
    ];

    const EXPECTED_ITEM = ITEMS[1];

    const getItems = (query: string) => {
      return Promise.resolve(
        ITEMS.filter((item) => {
          return item.label.includes(query);
        }),
      );
    };

    const changeHandler = jest.fn();
    const wrapper = mount<ComboBox<{ value: number; label: string }>>(
      <ComboBox onValueChange={changeHandler} getItems={getItems} />,
    );

    wrapper.find(ComboBoxView).prop('onFocus')?.();
    wrapper.update();
    wrapper.find('input').simulate('change', { target: { value: 'Two' } });

    await delay(300);

    clickOutside();
    await delay(0);
    wrapper.update();

    expect(changeHandler).toHaveBeenCalledWith(EXPECTED_ITEM);
  });

  describe('open/close methods', () => {
    let wrapper: ReactWrapper<ComboBoxProps<any>, unknown, ComboBox<any>>;

    beforeEach(() => {
      wrapper = mount<ComboBox<any>>(<ComboBox getItems={() => Promise.resolve([])} />);
      wrapper.instance().open();
      wrapper.update();
    });

    it('opens', () => {
      expect(wrapper.find(Menu)).toHaveLength(1);
    });

    it('closes', () => {
      wrapper.instance().close();
      wrapper.update();
      expect(wrapper.find(Menu)).toHaveLength(0);
    });

    it('closes on clickOutside', () => {
      clickOutside();
      wrapper.update();
      expect(wrapper.find(Menu)).toHaveLength(0);
    });
  });

  describe('search by method', () => {
    const VALUE = { value: 1, label: 'one' };
    let getItems: jest.Mock<Promise<Array<typeof VALUE>>>;
    let promise: Promise<void>;
    let wrapper: ReactWrapper<ComboBoxProps<typeof VALUE>, unknown, ComboBox<typeof VALUE>>;

    beforeEach(() => {
      [getItems, promise] = searchFactory(Promise.resolve([VALUE]));
      wrapper = mount<ComboBox<typeof VALUE>>(<ComboBox getItems={getItems} value={VALUE} />);
    });

    it('opens menu', async () => {
      wrapper.instance().search();
      await promise;
      wrapper.update();
      expect(wrapper.find(Menu)).toHaveLength(1);
    });

    it('searches current value by default', () => {
      wrapper.instance().search();
      expect(getItems).toHaveBeenCalledTimes(1);
      expect(getItems).toHaveBeenCalledWith(VALUE.label);
    });

    it('searches given query', () => {
      const QUERY = 'SEARCH_ME';
      wrapper.instance().search(QUERY);
      expect(getItems).toHaveBeenCalledTimes(1);
      expect(getItems).toHaveBeenCalledWith(QUERY);
    });
  });

  describe('keeps focus in input after', () => {
    const ITEMS = ['one', 'two', 'three'];
    let search: jest.Mock<Promise<string[]>>;
    let promise: Promise<void>;
    let wrapper: ReactWrapper<ComboBoxProps<string>, unknown, ComboBox<string>>;
    const onFocus = jest.fn();
    const onBlur = jest.fn();

    beforeEach(async () => {
      [search, promise] = searchFactory(Promise.resolve(ITEMS));
      wrapper = mount<ComboBox<string>>(
        <ComboBox getItems={search} onFocus={onFocus} onBlur={onBlur} renderItem={(x) => x} />,
        {
          attachTo: getAttachedTarget(),
        },
      );
      wrapper.find(ComboBoxView).prop('onFocus')?.();

      await promise;
      wrapper.update();

      onFocus.mockClear();
      onBlur.mockClear();
    });

    it('click on item', async () => {
      const inputNode = wrapper.find('input').getDOMNode() as HTMLInputElement;

      inputNode.blur(); // simulate blur from real click

      wrapper.find(MenuItem).first().simulate('click');

      await delay(0); // await for restore focus
      wrapper.update();

      expect(inputNode).toBeTruthy();
      expect(inputNode).toHaveFocus();
      expect(inputNode.selectionStart).toBe(inputNode.selectionEnd); // input text is not selected

      expect(onFocus).toHaveBeenCalledTimes(0);
      expect(onBlur).toHaveBeenCalledTimes(0);
    });

    it('Enter on item', async () => {
      wrapper.find('input').simulate('keydown', { key: 'ArrowDown' }).simulate('keydown', { key: 'Enter' });

      await delay(0);
      wrapper.update();

      const inputNode = wrapper.find('input').getDOMNode() as HTMLInputElement;

      expect(inputNode).toBeTruthy();
      expect(inputNode).toHaveFocus();
      expect(inputNode.selectionStart).toBe(inputNode.selectionEnd); // input text is not selected

      expect(onFocus).toHaveBeenCalledTimes(0);
      expect(onBlur).toHaveBeenCalledTimes(0);
    });
  });

  describe('click on input', () => {
    const VALUE = { value: 1, label: 'one' };
    type TComboBoxWrapper = ReactWrapper<ComboBoxProps<typeof VALUE>, unknown, ComboBox<typeof VALUE>>;
    const clickOnInput = (comboboxWrapper: TComboBoxWrapper) => {
      comboboxWrapper.update();
      comboboxWrapper.find('input').simulate('click');
    };
    let getItems: jest.Mock<Promise<Array<typeof VALUE>>>;
    let promise: Promise<void>;
    let wrapper: TComboBoxWrapper;

    describe('in default mode', () => {
      beforeEach(async () => {
        [getItems, promise] = searchFactory(Promise.resolve([VALUE]));
        wrapper = mount<ComboBox<typeof VALUE>>(<ComboBox getItems={getItems} value={VALUE} />);
        wrapper.find(ComboBoxView).prop('onFocus')?.();
        await promise;
        getItems.mockClear();
      });

      it('opens menu if it is closed', async () => {
        wrapper.instance().close();
        clickOnInput(wrapper);
        await delay(300);
        wrapper.update();
        expect(wrapper.find(Menu)).toHaveLength(1);
      });

      it('runs empty search if menu is closed', () => {
        wrapper.instance().close();
        clickOnInput(wrapper);
        expect(getItems).toHaveBeenCalledWith('');
      });

      it("doesn't run search if menu is open", () => {
        clickOnInput(wrapper);
        expect(getItems).toHaveBeenCalledTimes(0);
      });
    });

    describe('in autocomplete mode', () => {
      beforeEach(() => {
        wrapper = mount<ComboBox<typeof VALUE>>(
          <ComboBox drawArrow={false} searchOnFocus={false} getItems={getItems} value={VALUE} />,
        );
        wrapper.find(ComboBoxView).prop('onFocus')?.();
        getItems.mockClear();
      });

      it("doesn't open menu if it is closed", () => {
        wrapper.instance().close();
        clickOnInput(wrapper);
        expect(wrapper.find(Menu)).toHaveLength(0);
      });

      it("doesn't run search if menu is closed", () => {
        wrapper.instance().close();
        clickOnInput(wrapper);
        expect(getItems).toHaveBeenCalledTimes(0);
      });

      it("doesn't run search if menu is open", () => {
        clickOnInput(wrapper);
        expect(getItems).toHaveBeenCalledTimes(0);
      });
    });
  });

  describe('Search', () => {
    const query = 'one';
    const items = ['one', 'two'];

    it('without delay', async () => {
      const getItems = jest.fn(() => Promise.resolve(items));
      const wrapper = mount<ComboBox<string>>(<ComboBox getItems={getItems} />);

      wrapper.instance().search(query);

      await delay(0);

      expect(getItems).toHaveBeenCalledWith(query);

      expect(wrapper.find(CustomComboBox).instance().state).toMatchObject({
        requestStatus: ComboBoxRequestStatus.Success,
        loading: false,
        opened: true,
        items,
      });
    });

    it(`with delay < ${DELAY_BEFORE_SHOW_LOADER}`, async () => {
      const getItems = jest.fn(async () => {
        await delay(DELAY_BEFORE_SHOW_LOADER - 200);

        return Promise.resolve(items);
      });
      const wrapper = mount<ComboBox<string>>(<ComboBox getItems={getItems} />);

      wrapper.instance().search(query);

      await delay(0);

      expect(getItems).toHaveBeenCalledWith(query);

      await delay(DELAY_BEFORE_SHOW_LOADER);

      expect(wrapper.find(CustomComboBox).instance().state).toMatchObject({
        requestStatus: ComboBoxRequestStatus.Success,
        loading: false,
        opened: true,
        items,
      });
    });

    it(`with delay > ${DELAY_BEFORE_SHOW_LOADER}`, async () => {
      const getItems = jest.fn(async () => {
        await delay(DELAY_BEFORE_SHOW_LOADER + 200);

        return Promise.resolve(items);
      });
      const wrapper = mount<ComboBox<string>>(<ComboBox getItems={getItems} />);

      wrapper.instance().search(query);

      await delay(0);

      expect(getItems).toHaveBeenCalledWith(query);

      await delay(DELAY_BEFORE_SHOW_LOADER);

      expect(wrapper.find(CustomComboBox).instance().state).toMatchObject({
        requestStatus: ComboBoxRequestStatus.Pending,
        loading: true,
        opened: true,
      });

      await delay(LOADER_SHOW_TIME);
      await delay(0);

      expect(wrapper.find(CustomComboBox).instance().state).toMatchObject({
        requestStatus: ComboBoxRequestStatus.Success,
        loading: false,
        opened: true,
        items,
      });
    });

    it('rejected without delay', async () => {
      const getItems = jest.fn(() => Promise.reject());
      const wrapper = mount<ComboBox<string>>(<ComboBox getItems={getItems} />);

      wrapper.instance().search(query);

      await delay(0);

      expect(getItems).toHaveBeenCalledWith(query);
      expect(wrapper.find(CustomComboBox).instance().state).toMatchObject({
        requestStatus: ComboBoxRequestStatus.Failed,
        loading: false,
        opened: true,
      });
    });

    it(`rejected with delay < ${DELAY_BEFORE_SHOW_LOADER}`, async () => {
      const getItems = jest.fn(async () => {
        await delay(DELAY_BEFORE_SHOW_LOADER - 200);

        return Promise.reject();
      });
      const wrapper = mount<ComboBox<string>>(<ComboBox getItems={getItems} />);

      wrapper.instance().search(query);

      await delay(0);

      expect(getItems).toHaveBeenCalledWith(query);

      await delay(DELAY_BEFORE_SHOW_LOADER);

      expect(wrapper.find(CustomComboBox).instance().state).toMatchObject({
        requestStatus: ComboBoxRequestStatus.Failed,
        loading: false,
        opened: true,
      });
    });

    it(`rejected with delay > ${DELAY_BEFORE_SHOW_LOADER}`, async () => {
      const getItems = jest.fn(async () => {
        await delay(DELAY_BEFORE_SHOW_LOADER + 200);

        return Promise.reject();
      });
      const wrapper = mount<ComboBox<string>>(<ComboBox getItems={getItems} />);

      wrapper.instance().search(query);

      await delay(0);

      expect(getItems).toHaveBeenCalledWith(query);

      await delay(DELAY_BEFORE_SHOW_LOADER);

      expect(wrapper.find(CustomComboBox).instance().state).toMatchObject({
        requestStatus: ComboBoxRequestStatus.Pending,
        loading: true,
        opened: true,
      });

      await delay(LOADER_SHOW_TIME);

      expect(wrapper.find(CustomComboBox).instance().state).toMatchObject({
        requestStatus: ComboBoxRequestStatus.Failed,
        loading: false,
        opened: true,
      });
    });

    it('twice without delay', async () => {
      const secondQuery = 'two';
      const getItems = jest.fn((searchQuery) => Promise.resolve(items.filter((i) => i.includes(searchQuery))));
      const wrapper = mount<ComboBox<string>>(<ComboBox getItems={getItems} />);

      wrapper.instance().search(query);
      wrapper.instance().search(secondQuery);

      await delay(0);

      expect(getItems).toHaveBeenCalledTimes(2);
      expect(getItems).toHaveBeenCalledWith(query);
      expect(wrapper.find(CustomComboBox).instance().state).toMatchObject({
        requestStatus: ComboBoxRequestStatus.Success,
        loading: false,
        opened: true,
        items: ['two'],
      });
    });

    it(`twice with delay < ${DELAY_BEFORE_SHOW_LOADER}`, async () => {
      const secondQuery = 'two';
      const getItems = jest.fn(async (searchQuery) => {
        await delay(DELAY_BEFORE_SHOW_LOADER - 250);

        return Promise.resolve(items.filter((i) => i.includes(searchQuery)));
      });
      const wrapper = mount<ComboBox<string>>(<ComboBox getItems={getItems} />);

      wrapper.instance().search(query);

      await delay(DELAY_BEFORE_SHOW_LOADER - 300);

      wrapper.instance().search(secondQuery);

      await delay(DELAY_BEFORE_SHOW_LOADER);

      expect(getItems).toHaveBeenCalledTimes(2);
      expect(getItems).toHaveBeenCalledWith(query);
      expect(wrapper.find(CustomComboBox).instance().state).toMatchObject({
        requestStatus: ComboBoxRequestStatus.Success,
        loading: false,
        opened: true,
        items: ['two'],
      });
    });

    it(`twice with delay < ${DELAY_BEFORE_SHOW_LOADER} loader`, async () => {
      const secondQuery = 'two';
      const getItems = jest.fn(async (searchQuery) => {
        await delay(DELAY_BEFORE_SHOW_LOADER - 100);

        return Promise.resolve(items.filter((i) => i.includes(searchQuery)));
      });
      const wrapper = mount<ComboBox<string>>(<ComboBox getItems={getItems} />);

      wrapper.instance().search(query);

      await delay(DELAY_BEFORE_SHOW_LOADER - 200);

      wrapper.instance().search(secondQuery);

      await delay(DELAY_BEFORE_SHOW_LOADER - 100);

      expect(wrapper.find(CustomComboBox).instance().state).toMatchObject({
        requestStatus: ComboBoxRequestStatus.Pending,
        loading: true,
        opened: true,
      });

      await delay(LOADER_SHOW_TIME + 100);

      expect(getItems).toHaveBeenCalledTimes(2);
      expect(getItems).toHaveBeenCalledWith(query);
      expect(wrapper.find(CustomComboBox).instance().state).toMatchObject({
        requestStatus: ComboBoxRequestStatus.Success,
        loading: false,
        opened: true,
        items: ['two'],
      });
    });

    it(`twice with delay > ${DELAY_BEFORE_SHOW_LOADER}`, async () => {
      const secondQuery = 'two';
      const getItems = jest.fn(async (searchQuery) => {
        await delay(DELAY_BEFORE_SHOW_LOADER + 200);

        return Promise.resolve(items.filter((i) => i.includes(searchQuery)));
      });
      const wrapper = mount<ComboBox<string>>(<ComboBox getItems={getItems} />);

      wrapper.instance().search(query);

      await delay(DELAY_BEFORE_SHOW_LOADER - 300);

      wrapper.instance().search(secondQuery);

      await delay(300);

      expect(wrapper.find(CustomComboBox).instance().state).toMatchObject({
        requestStatus: ComboBoxRequestStatus.Pending,
        loading: true,
        opened: true,
      });

      await delay(LOADER_SHOW_TIME + 100);

      expect(getItems).toHaveBeenCalledTimes(2);
      expect(getItems).toHaveBeenCalledWith(query);
      expect(wrapper.find(CustomComboBox).instance().state).toMatchObject({
        requestStatus: ComboBoxRequestStatus.Success,
        loading: false,
        opened: true,
        items: ['two'],
      });
    });

    it('twice with slow then fast requests', async () => {
      const delays = [DELAY_BEFORE_SHOW_LOADER + 200, DELAY_BEFORE_SHOW_LOADER - 200];
      const secondQuery = 'two';
      const getItems = jest.fn(async (searchQuery) => {
        await delay(delays.shift() || 0);

        return Promise.resolve(items.filter((i) => i.includes(searchQuery)));
      });
      const wrapper = mount<ComboBox<string>>(<ComboBox getItems={getItems} />);

      wrapper.instance().search(query);

      await delay(300);

      wrapper.instance().search(secondQuery);

      await delay(DELAY_BEFORE_SHOW_LOADER - 300);

      expect(wrapper.find(CustomComboBox).instance().state).toMatchObject({
        requestStatus: ComboBoxRequestStatus.Pending,
        loading: true,
        opened: true,
      });

      await delay(200);

      expect(wrapper.find(CustomComboBox).instance().state).toMatchObject({
        requestStatus: ComboBoxRequestStatus.Pending,
        loading: true,
        opened: true,
      });

      await delay(LOADER_SHOW_TIME - 200);

      expect(getItems).toHaveBeenCalledTimes(2);
      expect(getItems).toHaveBeenCalledWith(query);
      expect(wrapper.find(CustomComboBox).instance().state).toMatchObject({
        requestStatus: ComboBoxRequestStatus.Success,
        loading: false,
        opened: true,
        items: ['two'],
      });
    });

    it('long request and blur before if resolves', async () => {
      const getItems = jest.fn(async () => {
        await delay(500);

        return Promise.resolve(items);
      });
      const wrapper = mount<ComboBox<string>>(<ComboBox getItems={getItems} />);

      wrapper.find(ComboBoxView).prop('onFocus')?.();

      await delay(300);

      expect(wrapper.find(CustomComboBox).instance().state).toMatchObject({
        loading: true,
        opened: true,
      });

      clickOutside();
      await delay(0);

      expect(wrapper.find(CustomComboBox).instance().state).toMatchObject({
        loading: false,
        opened: false,
      });

      wrapper.find(ComboBoxView).prop('onFocus')?.();

      await delay(300);

      expect(wrapper.find(CustomComboBox).instance().state).toMatchObject({
        loading: true,
        opened: true,
      });
    });

    it('long request and blur after it resolves', async () => {
      const getItems = jest.fn(async () => {
        await delay(500);

        return Promise.resolve(items);
      });
      const wrapper = mount<ComboBox<string>>(<ComboBox getItems={getItems} />);

      wrapper.find(ComboBoxView).prop('onFocus')?.();

      await delay(600);

      expect(wrapper.find(CustomComboBox).instance().state).toMatchObject({
        loading: true,
        opened: true,
      });

      clickOutside();
      await delay(0);

      expect(wrapper.find(CustomComboBox).instance().state).toMatchObject({
        loading: false,
        opened: false,
      });

      wrapper.find(ComboBoxView).prop('onFocus')?.();

      await delay(300);

      expect(wrapper.find(CustomComboBox).instance().state).toMatchObject({
        loading: true,
        opened: true,
      });
    });
  });

  describe('Locale', () => {
    let search: jest.Mock<Promise<any>>;
    let promise: Promise<any>;
    let wrapper: ReactWrapper;
    beforeEach(() => {
      [search, promise] = searchFactory(Promise.resolve(null));
    });
    const focus = async (): Promise<void> => {
      wrapper.find(ComboBoxView).prop('onFocus')?.();
      await promise;
      wrapper.update();
    };

    it('render without LocaleProvider', async () => {
      wrapper = mount(<ComboBox getItems={search} />);
      const expectedText = CustomComboBoxLocaleHelper.get(defaultLangCode).notFound;

      await focus();

      expect(wrapper.find(MenuMessage).text()).toBe(expectedText);
    });

    it('render default locale', async () => {
      wrapper = mount(<ComboBox getItems={search} />);
      const expectedText = CustomComboBoxLocaleHelper.get(defaultLangCode).notFound;

      await focus();

      expect(wrapper.find(MenuMessage).text()).toBe(expectedText);
    });

    it('render correct locale when set langCode', async () => {
      wrapper = mount(
        <LocaleContext.Provider value={{ langCode: LangCodes.en_GB }}>
          <ComboBox getItems={search} />
        </LocaleContext.Provider>,
      );
      const expectedText = CustomComboBoxLocaleHelper.get(LangCodes.en_GB).notFound;

      await focus();

      expect(wrapper.find(MenuMessage).text()).toBe(expectedText);
    });

    it('render custom locale', async () => {
      const customText = 'custom notFound';
      wrapper = mount(
        <LocaleContext.Provider value={{ locale: { ComboBox: { notFound: customText } } }}>
          <ComboBox getItems={search} />
        </LocaleContext.Provider>,
      );

      await focus();

      expect(wrapper.find(MenuMessage).text()).toBe(customText);
    });

    it('updates when langCode changes', async () => {
      wrapper = mount(
        <LocaleContext.Provider value={{}}>
          <ComboBox getItems={search} />
        </LocaleContext.Provider>,
      );
      const expected = CustomComboBoxLocaleHelper.get(LangCodes.en_GB).notFound;

      wrapper.setProps({ value: { langCode: LangCodes.en_GB } });
      await focus();

      expect(wrapper.find(MenuMessage).text()).toBe(expected);
    });
  });

  it.each(['', null, undefined])('should clear the value when %s passed', (testValue) => {
    const Comp = () => {
      const [value, setValue] = useState<unknown>({ value: 1, label: 'First' });

      const getItems = () => {
        return Promise.resolve([{ value: 1, label: 'First' }]);
      };

      return (
        <>
          <ComboBox getItems={getItems} onValueChange={setValue} value={value} />
          <button onClick={() => setValue(testValue)}>Clear</button>
        </>
      );
    };

    render(<Comp />);

    const input = screen.getByTestId('InputLikeText__input');
    expect(input).toHaveTextContent(/^First$/);

    userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(input).toHaveTextContent('');
  });

  describe('with add button', () => {
    const Comp = () => {
      const [selected, setSelected] = useState({ value: 3, label: 'Third' });
      const [shouldRenderAddButton, setShouldRenderAddButton] = useState(false);
      const [query, setQuery] = useState('');
      const [items, setItems] = useState([
        { value: 1, label: 'First' },
        { value: 2, label: 'Second' },
        { value: 3, label: 'Third' },
      ]);

      const getItems = () => {
        return Promise.resolve(items);
      };

      const handleValueChange = (value: { value: number; label: string }) => {
        setSelected(value);
        setShouldRenderAddButton(false);
      };

      const handleInputValueChange = (query: string) => {
        const isItemExists = items.find((x) => x.label.toLowerCase() === query.toLowerCase());
        setQuery(query);
        setShouldRenderAddButton(!isItemExists);
      };

      const addItem = () => {
        const newItem = {
          value: Math.max(...items.map(({ value }) => value)) + 1,
          label: query,
        };
        setItems([...items, newItem]);
        setSelected(newItem);
        setShouldRenderAddButton(false);
      };

      const renderAddButton = () => {
        if (!shouldRenderAddButton) {
          return null;
        }
        return (
          <MenuItem link onClick={addItem} data-tid={'addButton'}>
            + Добавить {query}
          </MenuItem>
        );
      };
      return (
        <ComboBox
          getItems={getItems}
          onValueChange={handleValueChange}
          value={selected}
          onInputValueChange={handleInputValueChange}
          renderAddButton={renderAddButton}
        />
      );
    };

    const addNewElement = async () => {
      render(<Comp />);
      await userEvent.click(screen.getByTestId(InputLikeTextDataTids.root));
      await userEvent.type(screen.getByRole('textbox'), 'newItem');
      await delay(0);
      await userEvent.click(screen.getByTestId('addButton'));
    };

    it('add new element', async () => {
      await addNewElement();
      expect(screen.getByRole('textbox')).toHaveValue('newItem');
    });

    it('show added item after blur', async () => {
      await addNewElement();
      await userEvent.click(screen.getByRole('textbox'));
      await delay(0);
      expect(screen.getAllByTestId(ComboBoxMenuDataTids.item)).toHaveLength(4);
      clickOutside();
      await delay(0);
      expect(screen.queryByTestId(ComboBoxMenuDataTids.item)).not.toBeInTheDocument();
      await userEvent.click(screen.getByTestId(InputLikeTextDataTids.root));
      await delay(0);
      expect(screen.getAllByTestId(ComboBoxMenuDataTids.item)).toHaveLength(4);
    });
  });

  it("should change item's wrapper if itemWrapper prop defined", async () => {
    const Comp = () => {
      const items = [
        { value: 1, label: 'First' },
        { value: 2, label: 'Second' },
      ];

      const itemWrapper = (item?: { value: number; label: string }) => {
        if (item?.value === 2) {
          return (props: HTMLProps['a']) => <a {...props} href="#" />;
        }

        return (props: HTMLProps['button']) => <button {...props} />;
      };

      const getItems = () => Promise.resolve(items);

      return <ComboBox itemWrapper={itemWrapper} getItems={getItems} />;
    };

    render(<Comp />);

    userEvent.click(screen.getByTestId(InputLikeTextDataTids.root));
    await delay(0);
    expect(screen.getByRole('button', { name: 'First' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Second' })).toBeInTheDocument();
  });
});
